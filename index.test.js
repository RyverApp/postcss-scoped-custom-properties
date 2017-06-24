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

function run(input, output, opts) {
    generate.reset();
    return postcss([ plugin(opts) ]).process(input)
        .then(result => {
            expect(ignoreSpace(result.css)).toEqual(ignoreSpace(output));
            expect(result.warnings().length).toBe(0);
        });
}


it('processes simple rule', () => {    
    return run(read(0, 'in'), read(0, 'out'), { generate: generate });
});

it('processes nested rule', () => {    
    return run(read(1, 'in'), read(1, 'out'), { generate: generate });
});

it('processes same rule', () => {    
    return run(read(2, 'in'), read(2, 'out'), { generate: generate });
});
