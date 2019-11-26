import {IRegistry, asResource} from 'phovea_core/src/plugin';

export default function (registry: IRegistry) {
  //registry.push('extension-type', 'extension-id', function() { return System.import('./extension_impl'); }, {});
  // generator-phovea:begin
  /// #if include('clue', 'selection')
  registry.push('actionFunction', 'select', function () {return System.import('./selection');}, {
    'factory': 'select'
  });

  registry.push('actionCompressor', 'idtype-selection', function () {return System.import('./selection');}, {
    'factory': 'compressSelection',
    'matches': 'select'
  });
  /// #endif

  /// #if include('clue', 'multiform')
  registry.push('actionFunction', 'transform', function () {return System.import('./multiform');}, {
    'factory': 'transform'
  });
  registry.push('actionFunction', 'changeVis', function () {return System.import('./multiform');}, {
    'factory': 'changeVis'
  });
  registry.push('actionFunction', 'select', function () {return System.import('./multiform');}, {
    'factory': 'select'
  });
  /// #endif

  registry.push('epPhoveaCoreLocale', 'phoveaClueLocaleEN', function () {
    return System.import('./assets/locales/en/phovea.json').then(asResource);
  }, {
      ns: 'phovea',
    });
  // generator-phovea:end
}
