var postcss = require('postcss');
var fs = require('fs');

var plugin = require('./');

var generate = (function() {
    var i = 0;
    var fn = function() {
        return '' + i++;
    }
    fn.reset = function() {
        i = 0;
    }
    return fn;
})();

function ignoreSpace(value) {
    return value.replace(/\s*/mg, ' ');
}

function read(number, inOrOut) {
    return fs.readFileSync('./test/' + number + '.' + inOrOut + '.css', 'utf8')
}

function run(short, opts) {
    opts = opts || {};
    opts.generate = opts.generate || (generate.reset(), generate);
    var input = fs.readFileSync('./test/' + short + '.css', 'utf8');
    var output = fs.readFileSync('./test/' + short + '.expected.css', 'utf8');    
    return postcss([ plugin(opts) ]).process(input)
        .then(result => {
            expect(ignoreSpace(result.css)).toEqual(ignoreSpace(output));
            expect(result.warnings().length).toBe(0);
        });
}

it('can support a basic scoped declaration', () => {    
    return run('basic-declaration');
});

it('can support a nested scoped declaration', () => {    
    return run('nested-declaration');
});

it('can have use in same scope ad declaration', () => {    
    return run('declaration-in-same-scope-as-use');
});

it('can use same prop more than once', () => {
    return run('use-same-more-than-once');
});

it('can use a scoped variable in a nested scope', () => {
    return run('nested-use');
});

it('can be used in combined value', () => {
    return run ('use-in-combined-value');
});