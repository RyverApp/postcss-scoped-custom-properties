# PostCSS Scoped Custom Properties [![Build Status](https://travis-ci.org/mmorton/postcss-scoped-custom-properties.svg)](https://travis-ci.org/mmorton/postcss-scoped-custom-properties)
> PostCSS plugin to enable some aspects of scoped custom properties.

PostCSS-scoped-custom-properties attempts to allow for some use of scoped custom properties in a manner that is compatible with other PostCSS plugins, wich limit custom property declarations to the `:root` selector.  The reasons for that limitation are sound, but sometimes you may want to live dangerously. 

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

## Usage

```js
postcss([ require('postcss-scoped-custom-properties')() ])
```
