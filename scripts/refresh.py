"""Refresh the dated, source-linked briefing. Uses Python 3.10+ stdlib only."""
import argparse
import concurrent.futures
import hashlib
import html
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import parse_qs, quote, urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen
from xml.etree import ElementTree

IST = timezone(timedelta(hours=5, minutes=30))
AIR = 'https://newsonair.gov.in'
PIB = 'https://pib.gov.in'
DISTRICT = 'https://westgodavari.ap.gov.in'
AP = 'Andhra Pradesh'
DATA = Path(__file__).resolve().parents[1] / 'dist/data/brief.json'
# Prefer the publisher's syndication endpoint. Akashvani also exposes WordPress search.
SOURCES = [
    ('Akashvani · Andhra Pradesh', AP, AIR, [
        ('wp', AIR + '/wp-json/wp/v2/posts?search=Andhra%20Pradesh&per_page=35&_fields=title,excerpt,link,date_gmt'),
        ('rss', AIR + '/?s=Andhra+Pradesh&feed=rss2')]),
    ('Press Information Bureau', 'India', PIB, [
        ('pib', 'https://www.pib.gov.in/AllRelease.aspx?reg=3&lang=1'),
        ('rss', PIB + '/RssMain.aspx?ModId=6&Lang=1&Regid=1')]),
    ('Akashvani · National', 'India', AIR, [
        ('rss', AIR + '/category/national/feed/'), ('index', AIR + '/category/national/')]),
    ('Akashvani · International', 'World', AIR, [
        ('rss', AIR + '/category/international/feed/'), ('index', AIR + '/category/international/')]),
    ('West Godavari district · తెలుగు', AP, DISTRICT, [
        ('rss', DISTRICT + '/category/news/press-release/feed/'),
        ('district', DISTRICT + '/category/news/press-release/')]),
]
GOOGLE = 'https://news.google.com'
for region, query in [(AP, '"Andhra Pradesh" (irrigation OR policy OR environment)'), ('India','India (economy OR parliament OR biodiversity)'), ('World','(climate treaty OR international summit OR global trade)')]:
    feed = GOOGLE + '/rss/search?q=' + quote(query+' when:7d') + '&hl=en-IN&gl=IN&ceid=IN:en'
    SOURCES.append(('Google News · '+region,region,GOOGLE,[('rss',feed)]))

PLACE = re.compile(r'\b(andhra pradesh|amaravati|vijayawada|visakhapatnam|tirupati|polavaram|kakinada|rayalaseema|srikakulam|vizianagaram|guntur|nellore|kadapa|kurnool|anantapur)\b', re.I)
TOPICS = {
    'Environment': r'climate|biodiversity|wetlands?|pollution|emissions?|renewables?|conservation|forests?|environment',
    'Geography': r'cyclones?|monsoons?|earthquakes?|weather|rivers?|rainfall|irrigation|drought|landslides?|reservoirs?|floods?',
    'Science': r'space|quantum|satellites?|vaccines?|technology|semiconductors?|isro|artificial intelligence|research',
    'Economy': r'economy|economic|gdp|banking|inflation|exports?|imports?|budgets?|agricultur\w*|markets?|taxation|employment',
    'International relations': r'bilateral|diplomatic|summits?|treaty|geopolitic\w*|united nations|foreign minister|brics|asean|g20',
    'Ethics': r'ethics|integrity|corruption|whistleblowers?|conflict of interest',
    'History': r'heritage|archaeolog\w*|inscriptions?|antiquities|ancient|medieval|museum',
    'Governance': r'constitution\w*|electoral|parliament\w*|courts?|legislation|policy|scheme|governance|cabinet|amendment',
}


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)


def plain(value):
    parser = PlainText()
    parser.feed(html.unescape(value or ''))
    return ' '.join(' '.join(parser.parts).split())


def official_link(value, origin):
    parts = urlsplit(urljoin(origin, value or ''))
    if (not value or parts.scheme not in ('http', 'https') or
            parts.hostname not in {urlsplit(origin).hostname, 'www.' + urlsplit(origin).hostname} or
            parts.username or parts.password or parts.port not in (None, 80, 443)):
        return None
    return urlunsplit(('https', parts.hostname.removeprefix('www.'), parts.path, parts.query, ''))


def publication_day(value):
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.strip().replace('Z', '+00:00'))
    except ValueError:
        try:
            dt = parsedate_to_datetime(value.strip())
        except (TypeError, ValueError, OverflowError):
            for fmt in ('%d %b %Y %H:%M:%S', '%d %B %Y %H:%M:%S', '%d/%m/%Y %H:%M:%S', '%m/%d/%Y %I:%M:%S %p'):
                try:
                    dt = datetime.strptime(value.strip(), fmt)
                    break
                except ValueError:
                    continue
            else:
                return None
    return (dt if dt.tzinfo else dt.replace(tzinfo=IST)).astimezone(IST).date().isoformat()


def classify(title, summary, region):
    telugu_terms = {'Economy': ('వ్యవసాయ', 'ధాన్యం', 'పంట', 'రైతు'), 'Governance': ('ఎన్నిక', 'బ్యాలెట్', 'నామినేషన్'), 'Science': ('యాంటీమైక్రోబియల్', 'సైన్స్'), 'Geography': ('వరద', 'తుఫాను')}
    for topic, words in telugu_terms.items():
        if any(word in title for word in words):
            return topic
    for part in (title, summary):
        for topic, terms in TOPICS.items():
            if re.search(r'\b(?:' + terms + r')\b', part, re.I):
                return topic
    return 'International relations' if region == 'World' else 'General studies'


def fetch(url):
    req = Request(url, headers={'User-Agent': 'CivicAtlas/1.0 (public education feed reader)', 'Accept': '*/*'})
    with urlopen(req, timeout=12) as response:
        data = response.read(4_000_001)
    if len(data) > 4_000_000:
        raise ValueError('source exceeded size limit')
    return data


def rss(data):
    root = ElementTree.fromstring(data)
    if root.tag.split('}')[-1].lower() not in ('rss', 'rdf', 'feed'):
        raise ValueError('expected a feed')
    for node in root.iter():
        if node.tag.split('}')[-1] not in ('item', 'entry'):
            continue
        fields = {child.tag.split('}')[-1]: child for child in node}
        def field(*keys):
            for key in keys:
                if key in fields:
                    return fields[key].text or fields[key].get('href', '')
            return ''
        yield field('title'), field('description', 'summary', 'encoded'), field('link'), field('pubDate', 'published', 'date', 'updated')


class ArticleIndex(HTMLParser):
    """Read heading links in AIR category cards when its RSS endpoint is unavailable."""
    def __init__(self):
        super().__init__()
        self.links = []
        self.heading = False
        self.anchor = None

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.anchor = dict(attrs).get('href')
        if tag in ('h2', 'h3'):
            self.heading = True
        if self.heading and self.anchor:
            self.links.append(self.anchor)

    def handle_endtag(self, tag):
        if tag in ('h2', 'h3'):
            self.heading = False
        if tag == 'a':
            self.anchor = None


class Metadata(HTMLParser):
    def __init__(self):
        super().__init__()
        self.fields = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'meta':
            self.fields[attrs.get('property') or attrs.get('name')] = attrs.get('content', '')
        if tag == 'time' and attrs.get('datetime'):
            self.fields.setdefault('datePublished', attrs['datetime'])


class DistrictIndex(HTMLParser):
    """NIC district listings show the title and publication date for each release."""
    def __init__(self, url):
        super().__init__()
        self.url = url
        self.rows = []
        self.current = None
        self.in_title = False
        self.in_paragraph = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'h2':
            self.finish()
            self.current = {'title': [], 'text': [], 'summary': [], 'link': ''}
            self.in_title = True
        if tag == 'p':
            self.in_paragraph = True
        if self.current and tag == 'a':
            href = attrs.get('href') or ''
            if self.in_title and href:
                self.current['link'] = official_link(href, DISTRICT) or ''
            elif not self.current['link']:
                query = parse_qs(urlsplit(href).query)
                for field in ('url', 'u'):
                    for target in query.get(field, []):
                        if target.startswith(DISTRICT + '/'):
                            self.current['link'] = official_link(target, DISTRICT) or ''

    def handle_endtag(self, tag):
        if tag == 'h2':
            self.in_title = False
        if tag == 'p':
            self.in_paragraph = False

    def handle_data(self, data):
        if self.current:
            self.current['text'].append(data)
            if self.in_title:
                self.current['title'].append(data)
            elif self.in_paragraph:
                self.current['summary'].append(data)

    def finish(self):
        if not self.current:
            return
        row = self.current
        title = ' '.join(' '.join(row['title']).split())
        date_match = re.search(r'Published on\s*:\s*(\d{2}/\d{2}/\d{4})', ' '.join(row['text']), re.I)
        if title and date_match:
            day = datetime.strptime(date_match[1], '%d/%m/%Y').date().isoformat()
            link = row['link'] or self.url + '#:~:text=' + quote(title[:70])
            summary = ' '.join(' '.join(row['summary']).split())
            summary = re.sub(r'Published on\s*:\s*\d{2}/\d{2}/\d{4}', '', summary, flags=re.I).strip()
            self.rows.append((title, summary, link, day))


def records(kind, url, origin, loader):
    data = loader(url)
    if kind == 'rss':
        yield from rss(data)
    elif kind == 'pib':
        items = []
        for li in re.findall(r'<li\b[^>]*>([\s\S]*?)</li>', data.decode('utf-8', 'replace'), re.I):
            anchor = re.search(r'''<a\b[^>]*?href=["']([^"']*PressRel(?:ease|ese)Detail\.aspx\?[^"']+)["'][^>]*>([\s\S]*?)</a>''', li, re.I)
            day = re.search(r'Posted on:\s*(\d{1,2} [A-Za-z]{3,9} \d{4})', li, re.I)
            if anchor and day:
                date = datetime.strptime(day[1], '%d %b %Y').date().isoformat()
                items.append((anchor[2], '', anchor[1], date))
        yield from sorted(items, key=lambda item: item[3], reverse=True)[:40]
    elif kind == 'district':
        page = DistrictIndex(url)
        page.feed(data.decode('utf-8', 'replace'))
        page.finish()
        yield from page.rows
    elif kind == 'wp':
        rows = json.loads(data)
        if not isinstance(rows, list):
            raise ValueError('expected posts')
        for row in rows:
            yield row['title']['rendered'], row['excerpt']['rendered'], row['link'], row['date_gmt'] + 'Z'
    else:
        index = ArticleIndex()
        index.feed(data.decode('utf-8', 'replace'))
        for raw in list(dict.fromkeys(index.links))[:12]:
            link = official_link(raw, origin)
            if not link or '/category/' in link:
                continue
            try:
                page = Metadata()
                page.feed(loader(link).decode('utf-8', 'replace'))
                fields = page.fields
                yield fields.get('og:title', '').split(' | Akashvani')[0], fields.get('og:description') or fields.get('description', ''), link, fields.get('article:published_time') or fields.get('datePublished')
            except (OSError, ValueError):
                continue


def get_source(spec, loader, today):
    name, region, origin, endpoints = spec
    had_response = False
    for kind, endpoint in endpoints:
        try:
            rows = list(records(kind, endpoint, origin, loader))
            items = []
            for raw_title, raw_summary, raw_link, raw_date in rows:
                title, summary = plain(raw_title), plain(raw_summary)
                link, day = official_link(raw_link, origin), publication_day(raw_date)
                if not title or not link or not day or day > today:
                    continue
                if origin == GOOGLE:
                    summary = ''  # Link to the publisher rather than reproducing syndicated content.
                relates_to_ap = PLACE.search(title + ' ' + summary)
                if origin == DISTRICT and kind == 'district' and '#:~:text=' in raw_link and link:
                    link += '#:~:text=' + quote(title[:70])
                if region == AP and origin != DISTRICT and not relates_to_ap:
                    continue
                story_region = AP if region == 'India' and PLACE.search(title) else region
                items.append({'id': hashlib.sha256(link.encode()).hexdigest()[:20], 'title': title[:350],
                              'summary': summary[:340].rsplit(' ', 1)[0] + '…' if len(summary) > 340 else summary,
                              'url': link, 'source': name, 'region': story_region, 'date': day,
                              'topic': classify(title, summary, story_region)})
            if items:
                if origin == GOOGLE:
                    items = items[:12]
                return {'name': name, 'status': 'ok', 'count': len(items), 'region': region}, items
            had_response = True
        except (OSError, ValueError, KeyError, TypeError, ElementTree.ParseError) as err:
            print(f'{name}: {kind} returned {type(err).__name__}', file=sys.stderr)
    return {'name': name, 'status': 'empty' if had_response else 'unavailable', 'count': 0, 'region': region}, []


def refresh(old, now, loader=fetch, sources=SOURCES):
    today = now.astimezone(IST).date().isoformat()
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        result = list(pool.map(lambda src: get_source(src, loader, today), sources))
    # Prefer fresh metadata. Collapse same URL or headline across official sources.
    items, ids, titles = [], set(), set()
    fresh = [i for _, rows in result for i in rows]
    for item in fresh + old.get('items', []):
        key = re.sub(r'[^\w]+', ' ', item['title'].casefold()).strip()
        if item['id'] in ids or item['url'] in ids or key in titles:
            continue
        ids.update([item['id'], item['url']])
        titles.add(key)
        items.append(item)
    items.sort(key=lambda item: item['date'], reverse=True)
    retained = []
    for region in (AP, 'India', 'World'):
        retained += [item for item in items if item['region'] == region][:90]
    return {'checkedAt': now.astimezone(timezone.utc).isoformat(), 'sources': [s for s, _ in result],
            'items': sorted(retained, key=lambda item: item['date'], reverse=True)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=DATA)
    path = parser.parse_args().output
    old = json.loads(path.read_text()) if path.exists() else {}
    data = refresh(old, datetime.now(timezone.utc))
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile('w', dir=path.parent, delete=False, encoding='utf-8') as tmp:
        json.dump(data, tmp, indent=2, ensure_ascii=False)
        tmp.write('\n')
    os.replace(tmp.name, path)
    print(', '.join(f"{s['name']}: {s['status']} ({s['count']})" for s in data['sources']))
    if not any(source['status'] == 'ok' for source in data['sources']):
        print('::warning::No dated official stories retrieved; previous coverage retained.')


if __name__ == '__main__':
    main()
