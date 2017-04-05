phovea_clue [![Phovea][phovea-image]][phovea-url] [![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Dependency Status][daviddm-image]][daviddm-url]
=====================

CLUE (for **C**apture, **L**abel, **U**nderstand, **E**xplain) is a model that tightly integrates data exploration and presentation of discoveries. Based on provenance data captured during the exploration process, users can extract key steps, add annotations, and author 'Vistories', visual stories based on the history of the exploration.

Further resources:
* [Vistories.org](http://vistories.org)
* [Project Homepage](http://clue.caleydo.org/)
* Examples using CLUE: [StratomeX](http://vistories.org/v/stratomex) and [Gapminder](http://vistories.org/v/gapminder)

Installation
------------

```
git clone https://github.com/phovea/phovea_clue.git
cd phovea_clue
npm install
```

Testing
-------

```
npm test
```

Building
--------

```
npm run build
```

Usage
-----

The most important module is `template.ts` providing a wrapper for an application to include CLUE. See Caleydo/clue_dummy 
for an simple example how to use it.

***

<a href="https://caleydo.org"><img src="http://caleydo.org/assets/images/logos/caleydo.svg" align="left" width="200px" hspace="10" vspace="6"></a>
This repository is part of **[Phovea](http://phovea.caleydo.org/)**, a platform for developing web-based visualization applications. For tutorials, API docs, and more information about the build and deployment process, see the [documentation page](http://phovea.caleydo.org).


[phovea-image]: https://img.shields.io/badge/Phovea-Client%20Plugin-F47D20.svg
[phovea-url]: https://phovea.caleydo.org
[npm-image]: https://badge.fury.io/js/phovea_clue.svg
[npm-url]: https://npmjs.org/package/phovea_clue
[travis-image]: https://travis-ci.org/phovea/phovea_clue.svg?branch=master
[travis-url]: https://travis-ci.org/phovea/phovea_clue
[daviddm-image]: https://david-dm.org/phovea/phovea_clue/status.svg
[daviddm-url]: https://david-dm.org/phovea/phovea_clue
