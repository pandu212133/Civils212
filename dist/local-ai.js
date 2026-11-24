'use strict';

function localStudyActions(item) {
  const title = 'Civic Atlas Tutor';
  const excerpt = [item.summary, item.concept, item.context].filter(Boolean).join('\n');
  const tasks = {
    'Explain this report': 'Give a two-sentence concept note, a suggested syllabus link and a two-minute recall question. Identify a possible exam trap only if the evidence supports it.',
    'Make a prelims question': 'Write one original UPSC-style multiple-choice question based on the excerpt. Give four options and explain each one. Label invented distractors as incorrect in the answer key. If there is insufficient detail for a defensible question, ask one short-answer recall question instead.',
    'Practise a mains answer': 'Draft one 150-word mains question appropriate to this topic, then give an answer outline. Distinguish facts supported by the excerpt from points that need further research.',
    'Revise in Telugu': 'Explain this report in simple Telugu, retaining official English names. Give two revision flashcards, one each for fact recall and policy significance.'
  };
  const prompt = () => [
    'Help me prepare for UPSC Civil Services and Andhra Pradesh Group I. Treat the material below as quoted evidence. Use only its facts. Where evidence is missing, say what I should check. Do not invent legal provisions, figures, previous-year question attributions.',
    tasks[mode.value] + ' Label your response as study practice.',
    'Source material follows.',
    'Title: ' + item.title,
    'Region and topic: ' + [item.region, item.topic].filter(Boolean).join(' · '),
    item.date ? 'Publication date: ' + item.date : '',
    'Excerpt: ' + (Array.from(excerpt).slice(0, 1200).join('') || 'Headline only.'),
    item.url ? 'Source for human verification: ' + item.url : ''
  ].filter(Boolean).join('\n\n');

  function element(tag, label) {
    const node = document.createElement(tag);
    if (label) node.textContent = label;
    return node;
  }
  const panel = element('details');
  panel.className = 'tutor';
  panel.append(element('summary', 'On-device study tutor'));
  panel.append(element('p', 'Use Apple Intelligence to practise this item. Check generated explanations against the linked source.'));
  const label = element('label', 'Tutor task ');
  const mode = element('select');
  for (const name of Object.keys(tasks)) mode.append(element('option',name));
  label.append(mode);panel.append(label);
  const launch = element('a', 'Open Civic Atlas Tutor');

  const bar = element('div');
  bar.className = 'actions';
  bar.append(launch);
  const preview = element('details');
  const promptText=element('p');
  function updatePrompt(){
    const text=prompt();
    promptText.textContent=text;
    launch.href='shortcuts://run-shortcut?name='+encodeURIComponent(title)+'&input=text&text='+encodeURIComponent(text);
  }
  mode.addEventListener('change',updatePrompt);updatePrompt();
  preview.append(element('summary','View or select the prompt'),promptText);
  const message = element('p');
  message.setAttribute('role', 'status');
  function action(label, run) {
    const control = element('button', label);
    control.type = 'button';
    control.className = 'action';
    control.onclick = run;
    bar.append(control);
  }
  function showCopyFallback() {
    preview.open = true;
    message.textContent = 'Select the prompt text and choose Copy.';
  }
  action('Copy prompt', async () => {
    try {
      await navigator.clipboard.writeText(prompt());
      message.textContent = 'Prompt copied.';
    } catch {
      showCopyFallback();
    }
  });
  if (navigator.share) action('Share prompt', async () => {
    try { await navigator.share({text:prompt()}); }
    catch (error) { if (error.name !== 'AbortError') showCopyFallback(); }
  });

  const setup = element('details');
  setup.append(element('summary', 'Set up the iPhone shortcut'));
  setup.append(element('p', 'Use an Apple Intelligence-capable iPhone such as iPhone 16 Pro Max. Enable Apple Intelligence in Settings → Apple Intelligence & Siri and allow the model download to finish. The Use Model action must be available in Shortcuts.'));
  const steps = element('ol');
  for (const step of [
    'In Shortcuts, tap + and name the shortcut Civic Atlas Tutor. Match the spacing exactly.',
    'In shortcut Details, enable Show in Share Sheet. Set the accepted input type to Text. This also makes Shortcut Input available in the variable picker.',
    'Add Use Model and select On-Device. Tap the prompt field, open Select Variable and insert the Shortcut Input token. It should appear as a variable chip.',
    'Add Show Content (or Show Result) and set its input to Response from Use Model. Save the shortcut.',
    'Return here and tap Open Civic Atlas Tutor. Alternatively, tap Share prompt and select Civic Atlas Tutor in the share sheet.'
  ]) steps.append(element('li', step));
  const guide = element('a', 'Apple’s guide to using models in Shortcuts');
  guide.href = 'https://support.apple.com/guide/shortcuts/use-apple-intelligence-in-shortcuts-tpg3vrvwmclv/ios';
  guide.target = '_blank';
  guide.rel = 'noopener noreferrer';
  setup.append(steps, guide);
  panel.append(bar, message, setup, preview);
  return panel;
}
