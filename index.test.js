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

function run(input, output, opts) {
    generate.reset();
    return postcss([ plugin(opts) ]).process(input)
        .then(result => {
            expect(ignoreSpace(result.css)).toEqual(ignoreSpace(output));
            expect(result.warnings().length).toBe(0);
        });
}


it('processes simple rule', () => {
    return run(fs.readFileSync('./test/0.in.css', 'utf8'), fs.readFileSync('./test/0.out.css', 'utf8'), { generate: generate });
});

it('processes nested rule', () => {
    return run(fs.readFileSync('./test/1.in.css', 'utf8'), fs.readFileSync('./test/1.out.css', 'utf8'), { generate: generate });
});
