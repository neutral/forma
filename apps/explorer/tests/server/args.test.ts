// project.md §explore: the command line forma-explorer reads, and every line it refuses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLine } from '../../src/server/args.ts';

test('project.md §explore: serve and export, with --project before or after the command', () => {
  assert.deepEqual(parseLine(['serve']), { command: 'serve', project: null, port: 0 });
  assert.deepEqual(parseLine(['serve', '--project', 'p', '--port', '4317']), { command: 'serve', project: 'p', port: 4317 });
  assert.deepEqual(parseLine(['--project', 'p', 'serve']), { command: 'serve', project: 'p', port: 0 });
  assert.deepEqual(parseLine(['serve', '--port', '1']), { command: 'serve', project: null, port: 1 });
  assert.deepEqual(parseLine(['serve', '--port', '65535']), { command: 'serve', project: null, port: 65535 });
  assert.deepEqual(parseLine(['export', 'out']), { command: 'export', project: null, destination: 'out' });
  assert.deepEqual(parseLine(['export', '--project', 'p', 'out']), { command: 'export', project: 'p', destination: 'out' });
  assert.deepEqual(parseLine(['--project', 'p', 'export', 'out']), { command: 'export', project: 'p', destination: 'out' });
});

test('project.md §explore: a malformed line, an unknown command or option and an option of the other command are refused, each with its reason', () => {
  const cases: [string[], RegExp][] = [
    [[], /no command is given/],
    [['explore'], /explore is no command forma-explorer knows/],
    [['--port', '1234'], /no command is given/],
    [['serve', '--port', '0'], /integer from 1 to 65535/],
    [['serve', '--port', '65536'], /integer from 1 to 65535/],
    [['serve', '--port', '-1'], /integer from 1 to 65535/],
    [['serve', '--port', '1.5'], /integer from 1 to 65535/],
    [['serve', '--port', 'NaN'], /integer from 1 to 65535/],
    [['serve', '--port', '1e3'], /integer from 1 to 65535/],
    [['serve', '--port', ''], /integer from 1 to 65535/],
    [['serve', '--port'], /--port is given without its value/],
    [['serve', '--port', '--project', 'p'], /--port is given without its value/],
    [['serve', '--port', '1234', '--port', '2345'], /--port is given twice/],
    [['serve', '--project', 'a', '--project', 'b'], /--project is given twice/],
    [['serve', '--project'], /--project is given without its value/],
    [['serve', '--unknown'], /--unknown is no option forma-explorer knows/],
    [['serve', '--json'], /--json is no option forma-explorer knows/],
    [['serve', 'extra'], /serve takes no argument, and was given "extra"/],
    [['export'], /export names the folder to write to/],
    [['export', 'a', 'b'], /export takes one folder, and was given "a" "b"/],
    [['export', 'out', '--port', '1234'], /--port is no option of forma-explorer export/],
    [['serve', 'export'], /serve takes no argument/],
  ];
  for (const [args, reason] of cases) {
    const line = parseLine(args);
    assert.ok('refused' in line, `${args.join(' ')} is refused`);
    assert.ok(line.refused.length > 0 && line.refused.every((says) => says.length > 0));
    assert.ok(line.refused.some((says) => reason.test(says)), `${args.join(' ')}: ${line.refused.join(' | ')}`);
  }
});

test('project.md §explore: every reason a line is refused for is given at once', () => {
  const line = parseLine(['serve', '--port', '0', '--unknown', 'extra']);
  assert.ok('refused' in line);
  assert.equal(line.refused.length, 3, line.refused.join(' | '));
});
