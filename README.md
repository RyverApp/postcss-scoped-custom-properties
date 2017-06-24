# PostCSS Scoped Vars [![Build Status][ci-img]][ci]

[PostCSS] plugin for scoped vars.

[PostCSS]: https://github.com/postcss/postcss
[ci-img]:  https://travis-ci.org/mmorton/postcss-scoped-vars.svg
[ci]:      https://travis-ci.org/mmorton/postcss-scoped-vars

```css
:root {
    --var0: blue;
}

.one {
    color: var(--var0);
}

.two {
    --var0: red;
}
```

```css
:root {
    --var0-0: red;
}

:root {
    --var0: blue;
}

.one {
    color: var(--var0);
}

.two {
    & .one {
        color: var(--var0-0);
    }
}
```

## Note
Currently, only nested declarations with `&` are emitted.  Soon, selectors will be chained appropriately unless otherwise specified.

## Usage

```js
postcss([ require('postcss-scoped-vars') ])
```

See [PostCSS] docs for examples for your environment.
