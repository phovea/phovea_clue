import { PluginRegistry, EP_PHOVEA_CORE_LOCALE } from 'phovea_core';
export default function (registry) {
    //registry.push('extension-type', 'extension-id', function() { return import('./extension_impl'); }, {});
    // generator-phovea:begin
    /// #if include('clue', 'selection')
    registry.push('actionFunction', 'select', function () { return import('./base/Selection').then((s) => s.Selection); }, {
        'factory': 'select'
    });
    registry.push('actionCompressor', 'idtype-selection', function () { return import('./base/Selection').then((s) => s.Selection); }, {
        'factory': 'compressSelection',
        'matches': 'select'
    });
    /// #endif
    /// #if include('clue', 'multiform')
    registry.push('actionFunction', 'transform', function () { return import('./base/Multiform').then((m) => m.Multiform); }, {
        'factory': 'transform'
    });
    registry.push('actionFunction', 'changeVis', function () { return import('./base/Multiform').then((m) => m.Multiform); }, {
        'factory': 'changeVis'
    });
    registry.push('actionFunction', 'select', function () { return import('./base/Multiform').then((m) => m.Multiform); }, {
        'factory': 'select'
    });
    /// #endif
    registry.push(EP_PHOVEA_CORE_LOCALE, 'phoveaClueLocaleEN', function () {
        return import('./assets/locales/en/phovea.json').then(PluginRegistry.getInstance().asResource);
    }, {
        ns: 'phovea',
    });
    // generator-phovea:end
}
//# sourceMappingURL=phovea.js.map