/* *****************************************************************************
 * Caleydo - Visualization for Molecular Biology - http://caleydo.org
 * Copyright (c) The Caleydo Team. All rights reserved.
 * Licensed under the new BSD license, available at http://caleydo.org/license
 **************************************************************************** */

import {PluginRegistry} from 'phovea_core';
import reg from './src/phovea';

/**
 * build a registry by registering all phovea modules
 */
//other modules
import 'phovea_core/phovea_registry.js';
import 'phovea_ui/phovea_registry.js';
import 'phovea_security_flask/phovea_registry.js';
//self
PluginRegistry.getInstance().register('phovea_clue',reg);
