$(document).ready(function() {
    var google_maps = new GoogleMaps({
        'map_canvas': document.getElementById('map-canvas')
    });
    google_maps.init();

    var storefinder = new Storefinder({
        'google_maps': google_maps,
        'nearby_btn': $('#nearyby'),
        'filter_inputs': [$('#filter-1'), $('#filter-2')]
    });
    storefinder.init();
    storefinder.load_stores('data/retailers.json', function() {
    });

});