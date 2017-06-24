var postcss = require('postcss');
var shortid = require('shortid');

var CSS_CUSTOM_PROP_RE = /^\s*(--[^:\s]+)/;
var CSS_VAR_RE = /^\s*var\(\s*([^,\)\s]+).*?\)/;

function path(node) {
    var res = [node];
    while ((node = node.parent, node.type !== 'root')) {
        res = [node].concat(res);
    }
    return res;
}

function createCleanClone(nodePath) {
    var res = Array(nodePath.length);
    res[0] = nodePath[0].clone();

    for (var i = 1, l = nodePath.length; i < l; i++) {
        res[i - 1].each(function (node) {
            if (node.source === nodePath[i].source) {
                res[i] = node;
            } else {
                node.remove();
            }
        });
    }

    res[res.length - 1].removeAll();

    return res;
}

function hash(node) {
    return node.source.input.id + ',' + node.source.start.line + ',' + node.source.end.line + ',' + node.source.start.column + ',' + node.source.end.column;
}

function ensure(v, o) {
    return v ? v : o;
}

function cleanup(node) {
    if (node.type === 'root') {
        return;
    }
    var parent = node.parent;
    node.remove();
    if (parent.nodes.length == 0) {
        cleanup(parent);
    }
}

function linSelector(node) {
    return path(node).map(node => node.selector).join(' ');
}

module.exports = postcss.plugin('postcss-scoped-vars', function (opts) {
    opts = opts || {};
    opts.generate = 'generate' in opts ? opts.generate : shortid.generate;

    return function (root, result) {        
        var idx;
        var varUse = {};
        var varUseByNode = {};
        var customDeclaration = {};
        var customDeclarationByNode = {};
        var customRemap = {};

        idx = 0;        
        root.walkDecls(function (decl) {
            var match;
            if ((match = CSS_CUSTOM_PROP_RE.exec(decl.prop)) && decl.parent.selector !== ':root') {
                var k = hash(decl.parent);                
                var propName = match[1];                   
                customDeclaration[propName] = ensure(customDeclaration[propName], []);
                customDeclaration[propName].push(k);                                                
                customDeclarationByNode[k] = ensure(customDeclarationByNode[k], { node: decl.parent, idx: idx, props: {}, remap: {}, clone: void 0 });
                customDeclarationByNode[k].props[propName] = ensure(customDeclarationByNode[k].props[propName], {});
                customDeclarationByNode[k].props[propName] = decl;
            }
            idx++;
        });    

        idx = 0;
        root.walkDecls(function (decl) {
            var match;
            if ((match = CSS_VAR_RE.exec(decl.value))) {                
                var k = hash(decl.parent);                
                var propName = match[1];                
                if (customDeclaration[propName]) {                    
                    varUse[propName] = ensure(varUse[propName], []);
                    varUse[propName].push(k);                       
                    varUseByNode[k] = ensure(varUseByNode[k], { node: decl.parent, idx: idx, props: {} });
                    varUseByNode[k].props[propName] = ensure(varUseByNode[k].props[propName], {});   
                    varUseByNode[k].props[propName] = decl;                                                
                }
            }
            idx++;
        });         

        var scopedCustomRootRule = postcss.rule({ selector: ':root' });        

        for (var k in customDeclarationByNode) {
            var id = opts.generate();
            for (var usePropName in customDeclarationByNode[k].props) {
                var prevDecl = customDeclarationByNode[k].props[usePropName];
                var nextDecl = prevDecl.clone({ prop: prevDecl.prop + '-' + id, raws: { between: ': ' }});

                scopedCustomRootRule.append(nextDecl);

                customDeclarationByNode[k].remap[prevDecl.prop] = nextDecl.prop;
            }
            customDeclarationByNode[k].clone = createCleanClone(path(customDeclarationByNode[k].node));
        }

        root.prepend(scopedCustomRootRule);

        for (var varUseK in varUseByNode) {
            var consumedCustomByNode = {};
            for (var usePropName in varUseByNode[varUseK].props) {
                for (var i = 0, l = customDeclaration[usePropName].length; i < l; i++) {
                    var customDeclarationK = customDeclaration[usePropName][i];
                    
                    if (consumedCustomByNode[customDeclarationK]) continue;
                    consumedCustomByNode[customDeclarationK] = true;
                    
                    if (varUseK !== customDeclarationK) {
                        var nextScopeRule = createCleanClone(customDeclarationByNode[customDeclarationK].clone);
                        varUseByNode[varUseK].node.after(nextScopeRule[0]);

                        var nextInnerRule = varUseByNode[varUseK].node.clone({ 
                            selector: '& ' + varUseByNode[varUseK].node.selector,
                            raws: { } 
                        });

                        nextInnerRule.removeAll();
                        
                        for (var customPropName in customDeclarationByNode[customDeclarationK].props) {
                            if (varUseByNode[varUseK].props[customPropName]) {
                                nextInnerRule.append(postcss.decl({ 
                                    prop: varUseByNode[varUseK].props[customPropName].prop, 
                                    value: 'var(' + customDeclarationByNode[customDeclarationK].remap[customPropName] + ')' 
                                }));
                            }
                        }
                        
                        nextScopeRule[nextScopeRule.length - 1].append(nextInnerRule);             
                    } else {
                        var nextInnerRule = varUseByNode[varUseK].node;
                        for (var customPropName in customDeclarationByNode[customDeclarationK].props) {
                            if (varUseByNode[varUseK].props[customPropName]) {
                                nextInnerRule.append(postcss.decl({
                                    prop: varUseByNode[varUseK].props[customPropName].prop,
                                    value: 'var(' + customDeclarationByNode[customDeclarationK].remap[customPropName] + ')'
                                }));
                                varUseByNode[varUseK].props[customPropName].remove();
                            }
                        }
                    }
                }
            }
        }

        for (var k in customDeclarationByNode) {
            for (var usePropName in customDeclarationByNode[k].props) {
                cleanup(customDeclarationByNode[k].props[usePropName]);                
            }
        }
    };
});
 