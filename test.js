import test from 'ava';
import indentString from 'indent-string';
import execa from 'execa';
import sinon from 'sinon';
import pkg from './package';
import m from '.';

test('return object', t => {
	const cli = m({
		argv: ['foo', '--foo-bar', '-u', 'cat', '--', 'unicorn', 'cake'],
		help: `
			Usage
			  foo <input>
		`,
		flags: {
			unicorn: {alias: 'u'},
			meow: {default: 'dog'},
			'--': true
		}
	});

	t.is(cli.input[0], 'foo');
	t.true(cli.flags.fooBar);
	t.is(cli.flags.meow, 'dog');
	t.is(cli.flags.unicorn, 'cat');
	t.deepEqual(cli.flags['--'], ['unicorn', 'cake']);
	t.is(cli.pkg.name, 'meow');
	t.is(cli.help, indentString('\nCLI app helper\n\nUsage\n  foo <input>\n', 2));
});

test('support help shortcut', t => {
	const cli = m(`
		unicorn
		cat
	`);
	t.is(cli.help, indentString('\nCLI app helper\n\nunicorn\ncat\n', 2));
});

test('spawn cli and show version', async t => {
	const {stdout} = await execa('./fixture.js', ['--version']);
	t.is(stdout, pkg.version);
});

test('spawn cli and not show version', async t => {
	const {stdout} = await execa('./fixture.js', ['--version', '--no-auto-version']);
	t.is(stdout, 'version\nautoVersion\nmeow\ncamelCaseOption');
});

test('spawn cli and show help screen', async t => {
	const {stdout} = await execa('./fixture.js', ['--help']);
	t.is(stdout, indentString('\nCustom description\n\nUsage\n  foo <input>\n\n', 2));
});

test('spawn cli and not show help screen', async t => {
	const {stdout} = await execa('./fixture.js', ['--help', '--no-auto-help']);
	t.is(stdout, 'help\nautoHelp\nmeow\ncamelCaseOption');
});

test('spawn cli and test input', async t => {
	const {stdout} = await execa('./fixture.js', ['-u', 'cat']);
	t.is(stdout, 'u\nunicorn\nmeow\ncamelCaseOption');
});

test('spawn cli and test input flag', async t => {
	const {stdout} = await execa('./fixture.js', ['--camel-case-option', 'bar']);
	t.is(stdout, 'bar');
});

// TODO: This fails in Node.js 7.10.0, but not 6 or 4
test.serial.skip('pkg.bin as a string should work', t => { // eslint-disable-line ava/no-skip-test
	m({
		pkg: {
			name: 'browser-sync',
			bin: 'bin/browser-sync.js'
		}
	});

	t.is(process.title, 'browser-sync');
});

test('single character flag casing should be preserved', t => {
	t.deepEqual(m({argv: ['-F']}).flags, {F: true});
});

test('type inference', t => {
	t.is(m({argv: ['5']}).input[0], '5');
	t.is(m({argv: ['5']}, {input: 'string'}).input[0], '5');
	t.is(m({
		argv: ['5'],
		inferType: true
	}).input[0], 5);
	t.is(m({
		argv: ['5'],
		inferType: true,
		flags: {foo: 'string'}
	}).input[0], 5);
	t.is(m({
		argv: ['5'],
		inferType: true,
		flags: {
			foo: 'string'
		}
	}).input[0], 5);
	t.is(m({
		argv: ['5'],
		input: 'number'
	}).input[0], 5);
});

test('booleanDefault: undefined, filter out unset boolean args', t => {
	t.deepEqual(m('help', {
		argv: ['--foo'],
		booleanDefault: undefined,
		flags: {
			foo: {
				type: 'boolean'
			},
			bar: {
				type: 'boolean'
			},
			baz: {
				type: 'boolean',
				default: false
			}
		}
	}).flags, {
		foo: true,
		baz: false
	});
});

test('boolean args are false by default', t => {
	t.deepEqual(m('help', {
		argv: ['--foo'],
		flags: {
			foo: {
				type: 'boolean'
			},
			bar: {
				type: 'boolean',
				default: true
			},
			baz: {
				type: 'boolean'
			}
		}
	}).flags, {
		foo: true,
		bar: true,
		baz: false
	});
});

test('enforces boolean flag type', t => {
	const cli = m('', {
		argv: ['--cursor=false'],
		flags: {
			cursor: {type: 'boolean'}
		}
	});
	t.deepEqual(cli.flags, {cursor: false});
});

test('accept help and options', t => {
	t.deepEqual(m('help', {
		argv: ['-f'],
		flags: {
			foo: {
				type: 'boolean',
				alias: 'f'
			}
		}
	}).flags, {
		foo: true,
		f: true
	});
});

test('showHelp exits with return code', t => {
	const cli = m(`whatever`);

	function showHelp(code) {
		const exit = sinon.stub(process, 'exit');
		const log = sinon.spy(console, 'log');
		const error = sinon.spy(console, 'error');
		try {
			cli.showHelp(code);
		} catch (e) {
			console.log(e);
		}
		process.exit.restore();
		console.log.restore();
		console.error.restore();
		return {exit, log, error};
	}

	[
		[undefined, [2, false, true]],
		[1, [1, false, true]],
		[0, [0, true, false]]
	].forEach(([codeFixture, [exitCode, logCalled, errorCalled]]) => {
		const {exit, log, error} = showHelp(codeFixture);
		t.true(exit.calledWith(exitCode));
		t.is(logCalled, log.called);
		t.is(errorCalled, error.called);
	});
});
