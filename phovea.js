/* *****************************************************************************
 * Caleydo - Visualization for Molecular Biology - http://caleydo.org
 * Copyright (c) The Caleydo Team. All rights reserved.
 * Licensed under the new BSD license, available at http://caleydo.org/license
 **************************************************************************** */

//register all extensions in the registry following the given pattern
module.exports = function(registry) {
  //registry.push('extension-type', 'extension-id', function() { return System.import('./src/extension_impl'); }, {});
  // generator-phovea:begin
  registry.push('actionFunction', 'select', function() { return System.import('./src/selection'); }, {
    'factory': 'select'
  });

  registry.push('actionCompressor', 'idtype-selection', function() { return System.import('./src/selection'); }, {
    'factory': 'compressSelection',
    'matches': 'select'
  });

  registry.push('actionFunction', 'transform', function() { return System.import('./src/multiform'); }, {
    'factory': 'transform'
  });
  registry.push('actionFunction', 'changeVis', function() { return System.import('./src/multiform'); }, {
    'factory': 'changeVis'
  });
  registry.push('actionFunction', 'select', function() { return System.import('./src/multiform'); }, {
    'factory': 'select'
  });
  // generator-phovea:end
};

