import {IRegistry, PluginRegistry, ILocaleEPDesc, LocaleExtensionPointDesc} from 'phovea_core';


export default function (registry: IRegistry) {
  //registry.push('extension-type', 'extension-id', function() { return System.import('./extension_impl'); }, {});
  // generator-phovea:begin
  /// #if include('clue', 'selection')
  registry.push('actionFunction', 'select', function () {return System.import('./Selection');}, {
    'factory': 'select'
  });

  registry.push('actionCompressor', 'idtype-selection', function () {return System.import('./Selection');}, {
    'factory': 'compressSelection',
    'matches': 'select'
  });
  /// #endif

  /// #if include('clue', 'multiform')
  registry.push('actionFunction', 'transform', function () {return System.import('./Multiform');}, {
    'factory': 'transform'
  });
  registry.push('actionFunction', 'changeVis', function () {return System.import('./Multiform');}, {
    'factory': 'changeVis'
  });
  registry.push('actionFunction', 'select', function () {return System.import('./Multiform');}, {
    'factory': 'select'
  });
  /// #endif

  registry.push(LocaleExtensionPointDesc.EP_PHOVEA_CORE_LOCALE, 'phoveaClueLocaleEN', function () {
    return System.import('./assets/locales/en/phovea.json').then(PluginRegistry.getInstance().asResource);
  }, <ILocaleEPDesc>{
    ns: 'phovea',
  });
  // generator-phovea:end
}
