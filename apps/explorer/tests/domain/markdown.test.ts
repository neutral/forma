// A passage as written (presentation.md §explorer, "The document"): Markdown with raw HTML disabled, and
// links between the brief's documents moved within the page.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { linkedDocuments, passageHtml } from '../../src/domain/markdown.ts';

const from = 'design/brief/overview.md';

test('presentation.md §explorer: a passage keeps no raw HTML', () => {
  const html = passageHtml('A <script>alert(1)</script> and <b style="x">bold</b>.', from, () => null);
  assert.ok(!html.includes('<script') && !html.includes('<b'));
  assert.match(html, /&lt;script&gt;/);
});

test("presentation.md §explorer: a link to another of the brief's documents moves to it on the page", () => {
  const asked: [string, string | null][] = [];
  const landing = (file: string, fragment: string | null) => {
    asked.push([file, fragment]);
    return file === 'design/brief/changes/v2.md' ? 'p-v2' : null;
  };
  const html = passageHtml(
    '[the change](changes/v2.md#retry), [elsewhere](../other.md), [outside](https://example.com/a.md) and [here](#scope).',
    from,
    landing,
  );
  assert.match(html, /<a href="#p-v2">the change<\/a>/);
  assert.match(html, /<a href="\.\.\/other\.md">elsewhere<\/a>/, 'a document the page does not hold is left as written');
  assert.match(html, /<a href="https:\/\/example\.com\/a\.md">outside<\/a>/);
  assert.match(html, /<a href="#scope">here<\/a>/);
  assert.deepEqual(asked, [
    ['design/brief/changes/v2.md', '#retry'],
    ['design/other.md', null],
  ]);
});

test('presentation.md §explorer: the documents a text links to, in the order of its links, each once', () => {
  const text = 'See [b](b.md), then [a](./sub/a.md#x), [b again](b.md) and [web](http://x/y.md).\n\n```\n[not a link](c.md)\n```';
  assert.deepEqual(linkedDocuments(text, from), ['design/brief/b.md', 'design/brief/sub/a.md']);
});
