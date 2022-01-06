# morphic

Node.js Static Site Generator

## Usage

```
mkdir morphic-site
```

```
cd morphic-site
```

```
git init
```

```
echo 'node_modules' > .gitignore
```

```
npm i @protolith/morphic@latest
```

```
mkdir public
```

```
mkdir content
```

```
mkdir templates
```

```
cd content
```

```
echo '---
title: Home
---

# <%= model.title %>

home page content' > index.md
```

```
cd ../templates
```

```
echo '<!DOCTYPE html>
<html>
  <head>
    <title><%= model.title %></title>
  </head>
  <body>
    <%- model.content %>
  </body>
</html>' > index.ejs
```

```
cd ..
```

With the default files created, from the morphic-site folder run the command:

```
npx morphic --serve
```

This will create an output folder containing the generated html, and open a browser window to view.

## Build

Clone repo and run:

```
npm run build
```

or

```
npm run build-typecheck
```

These commands will compile the typescript src directory to a new folder named dist, containing the javascript output.

Building without typechecking will not pass source files through the typescript compiler (only babel).

## Notice

Morphic is very much still a work in progress and is not ready for production use.
