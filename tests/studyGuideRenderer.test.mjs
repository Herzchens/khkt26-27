import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StudyGuideArticle } from '../src/adventure/StudyGuideRenderer.ts';
import { createStudyGuideReviewState, reduceStudyGuideReview } from '../src/adventure/studyGuideReview.ts';

function renderArticle(title, text) {
  return renderToStaticMarkup(createElement(StudyGuideArticle, { title, text }));
}

test('renders guide Markdown as readable article structure and formats common chemistry and math notation', () => {
  const html = renderArticle(
    'Ôn tập quang hợp',
    '## Ý chính\nQuang hợp tạo **glucose** và giải phóng O₂.\n\n| Chất | Công thức |\n| --- | --- |\n| Nước | $\\ce{H2O}$ |\n\n- Nhận ánh sáng\n- Tạo năng lượng $E = mc^2$\n\nPhản ứng: $\\ce{2H2 + O2 \\rightarrow 2H2O}$. Chỉ số $x_{n+1}$ giúp phân biệt các giá trị.',
  );

  assert.match(html, /<h2>Ôn tập quang hợp<\/h2>/);
  assert.match(html, /<h3>Ý chính<\/h3>/);
  assert.match(html, /<strong>glucose<\/strong>/);
  assert.match(html, /<table>/);
  assert.match(html, /<th scope="col">Chất<\/th>/);
  assert.match(html, /H<sub>2<\/sub>O/);
  assert.match(html, /<ul><li>Nhận ánh sáng<\/li><li>Tạo năng lượng/);
  assert.match(html, /mc<sup>2<\/sup>/);
  assert.match(html, /2H<sub>2<\/sub> \+ O<sub>2<\/sub> → 2H<sub>2<\/sub>O/);
  assert.match(html, /x<sub>n\+1<\/sub>/);
  assert.match(html, /<article class="study-guide__article" aria-label="Bản xem trước: Ôn tập quang hợp" tabindex="0">/);
});

test('keeps amino-acid charge signs separate from following bonds', () => {
  const html = renderArticle('Amino acid', '$H_3N^+-R-COO^-$');

  assert.match(html, /H<sub>3<\/sub>N<sup>\+<\/sup>-R-COO<sup>-<\/sup>/);
});

test('groups multi-term fractions and preserves grouping in unsupported math commands', () => {
  const html = renderArticle('Toán học', '$\\frac{a+b}{c+d}$; $\\unknown{x+y}$');

  assert.match(html, /\(a\+b\)⁄\(c\+d\)/);
  assert.match(html, /\\unknown\{x\+y\}/);
  assert.match(renderArticle('Phân số', '$\\frac{a}{2x}$'), /a⁄\(2x\)/);
});

test('treats raw HTML as text and omits unsafe Markdown links while keeping HTTPS links usable', () => {
  const html = renderArticle(
    'Kiểm tra an toàn',
    '<img src=x onerror=alert(1)> [mở trang lạ](javascript:alert(1)) [nguồn](https://example.com)',
  );

  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img\b/);
  assert.doesNotMatch(html, /href="javascript:/i);
  assert.match(html, /mở trang lạ/);
  assert.match(html, /<a href="https:\/\/example\.com" target="_blank" rel="noopener noreferrer">nguồn<\/a>/);
});

test('switches between preview and editing without replacing the original editable Markdown draft', () => {
  const draft = { title: 'Ôn Sinh học', text: '## Tế bào\nMàng tế bào điều hòa trao đổi chất.' };
  const initial = createStudyGuideReviewState();
  const generated = reduceStudyGuideReview(initial, { type: 'generated', draft });
  const editing = reduceStudyGuideReview(generated, { type: 'set-view', view: 'edit' });
  const edited = reduceStudyGuideReview(editing, { type: 'edit-text', text: `${draft.text}\nGhi chú riêng.` });
  const preview = reduceStudyGuideReview(edited, { type: 'set-view', view: 'preview' });

  assert.equal(generated.view, 'preview');
  assert.equal(generated.draft.text, draft.text);
  assert.equal(editing.view, 'edit');
  assert.equal(editing.draft.text, draft.text);
  assert.equal(edited.draft.text, `${draft.text}\nGhi chú riêng.`);
  assert.equal(preview.view, 'preview');
  assert.equal(preview.draft.text, `${draft.text}\nGhi chú riêng.`);
});
