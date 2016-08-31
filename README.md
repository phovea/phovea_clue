Caleydo CLUE ![Caleydo Web Client Plugin](https://img.shields.io/badge/Caleydo%20Web-Client%20Plugin-F47D20.svg)
===================

CLUE (for **C**apture, **L**abel, **U**nderstand, **E**xplain) is a model that tightly integrates data exploration and presentation of discoveries. Based on provenance data captured during the exploration process, users can extract key steps, add annotations, and author 'Vistories', visual stories based on the history of the exploration.

Further resources:
* [Vistories.org](http://vistories.org)
* [Project Homepage](http://clue.caleydo.org/)
* Examples using CLUE: [StratomeX](http://vistories.org/v/stratomex) and [Gapminder](http://vistories.org/v/gapminder)

Installation
------------

[Set up a virtual machine using Vagrant](http://www.caleydo.org/documentation/vagrant/) and run these commands inside the virtual machine:

```bash
./manage.sh clone Caleydo/caleydo_clue
./manage.sh resolve
```

If you want this plugin to be dynamically resolved as part of another application of plugin, you need to add it as a peer dependency to the _package.json_ of the application or plugin it should belong to:

```json
{
  "peerDependencies": {
    "caleydo_clue": "*"
  }
}
```

Usage
-----

The most important module is `template.ts` providing a wrapper for an application to include CLUE. See Caleydo/clue_dummy 
for an simple example how to use it.


***

<a href="https://caleydo.org"><img src="http://caleydo.org/assets/images/logos/caleydo.svg" align="left" width="200px" hspace="10" vspace="6"></a>
This repository is part of **[Caleydo Web](http://caleydo.org/)**, a platform for developing web-based visualization applications. For tutorials, API docs, and more information about the build and deployment process, see the [documentation page](http://caleydo.org/documentation/).
