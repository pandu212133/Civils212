import json
import unittest
from datetime import datetime, timezone
from refresh import AP, AIR, PIB, SOURCES, classify, get_source, official_link, publication_day, refresh

NOW = datetime(2026, 11, 24, 12, tzinfo=timezone.utc)
DAY = NOW.date().isoformat()
def rss_fixture():
    return b"""<rss><channel><item><title>Polavaram irrigation report</title>
    <description><![CDATA[<p>Project status.</p>]]></description>
    <pubDate>Tue, 24 Nov 2026 06:45:00 +0530</pubDate>
    <link>https://www.pib.gov.in/PressReleasePage.aspx?PRID=10</link></item></channel></rss>"""


class UpdateTests(unittest.TestCase):
    def test_region_classification_and_ids(self):
        data = refresh({}, NOW, lambda _: rss_fixture(), [SOURCES[1], SOURCES[1]])
        self.assertEqual(len(data['items']), 1)
        item = data['items'][0]
        self.assertEqual((item['region'], item['topic'], item['date']), (AP, 'Geography', DAY))
        self.assertEqual(item['summary'], 'Project status.')
        self.assertEqual(classify('Cabinet reviews heritage restoration', '', 'India'), 'History')

    def test_wp_search_filters_an_incidental_match_out(self):
        rows = [{'title': {'rendered': t}, 'excerpt': {'rendered': ''}, 'link': AIR + '/story' + str(i), 'date_gmt': '2026-11-23T22:00:00'} for i,t in enumerate(['State policy in Andhra Pradesh', 'Odisha festival'])]
        status, items = get_source(SOURCES[0], lambda _: json.dumps(rows).encode(), DAY)
        self.assertEqual(status['count'], 1)
        self.assertEqual(items[0]['date'], DAY)

    def test_district_archive_supplies_dates_and_links_in_telugu(self):
        def loader(url):
            if url.endswith('/feed/'):
                raise TimeoutError()
            return '<h2>పంచాయతీ ఎన్నికలు</h2><span>Published on: </span><span>23/11/2026</span><p>ముఖ్య వివరాలు</p><h2>వరద పరిస్థితి</h2> Published on: 22/11/2026'.encode()
        status, items = get_source(SOURCES[4], loader, DAY)
        self.assertEqual(status['count'], 2)
        self.assertEqual(items[0]['region'], AP)
        self.assertEqual(items[0]['topic'], 'Governance')
        self.assertEqual(items[1]['date'], '2026-11-22')
        self.assertNotEqual(items[0]['url'], items[1]['url'])

    def test_external_link_rejected(self):
        self.assertIsNone(official_link('https://pib.gov.in.foo.example/a', PIB))
        self.assertIsNone(official_link('javascript:alert(1)', PIB))
        self.assertEqual(official_link('/article/a#share', AIR), AIR + '/article/a')

    def test_source_outage_preserves_items_with_original_dates(self):
        old = refresh({}, NOW, lambda _: rss_fixture(), [SOURCES[1]])
        def offline(_): raise TimeoutError()
        new = refresh(old, NOW, offline, [SOURCES[1]])
        self.assertEqual(new['items'], old['items'])
        self.assertEqual(new['sources'][0]['status'], 'unavailable')

    def test_html_fallback_uses_article_metadata(self):
        def loader(url):
            if url.endswith('/feed/'): return b'Sorry'
            if url.endswith('/international/'): return b'<h3><a href="/treaty/">Treaty</a></h3>'
            return b'<meta property="article:published_time" content="2026-11-23T23:30:00Z"><meta property="og:description" content="Treaty announced."><meta property="og:title" content="A bilateral treaty | Akashvani News">'
        status, items = get_source(SOURCES[3], loader, DAY)
        self.assertEqual(status['status'], 'ok')
        self.assertEqual(items[0]['title'], 'A bilateral treaty')
        self.assertEqual(items[0]['topic'], 'International relations')
        self.assertEqual(items[0]['date'], DAY)

    def test_unusable_dates_do_not_appear_as_today(self):
        self.assertIsNone(publication_day('yesterday'))
        status, items = get_source(SOURCES[1], lambda _: rss_fixture().replace(b'24 Nov 2026', b'24 Nov 2027'), DAY)
        self.assertEqual((status['status'], items), ('empty', []))

if __name__ == '__main__': unittest.main()
