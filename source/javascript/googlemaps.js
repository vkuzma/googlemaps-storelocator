function GoogleMaps(options) {
    this.map_canvas = null;
    this.map = null;
    this.init_position = [51.692641,4.797791];   // Switzerland as default position
    this.info_window = null;
    this.initial_search_radius = 20;
    this.max_search_radius = 300;
    this.search_radius_steps = 10;
    this.current_location_marker = null;
    this.zoome_levels = {
        'detail': 12,
        'init': 5
    };
    this.markers = [];
    this.visible_markers = [];

    // Marker cluster (from google-maps-utility-library-v3)
    this.marker_cluster = null;
    this.marker_cluster_options = null;
    this.enable_marker_cluster = false;

    for(var key in options)
        this[key] = options[key];
}

GoogleMaps.prototype = {
    init: function() {
        var latlng = new google.maps.LatLng(this.init_position[0], this.init_position[1]);
        if(!this['map_options']) {
            this.map_options = {
                zoom: this.zoome_levels.init,
                center: latlng,
                mapTypeId: google.maps.MapTypeId.ROADMAP,
                disableDefaultUI: false,
                scrollwheel: false
            };
        }

        this.map = new google.maps.Map(this.map_canvas, this.map_options);

        this.init_marker_cluster();
    },
    init_marker_cluster: function() {
        if(!this['cluster_styles']) {
            this.cluster_styles = [{
                url: 'images/m1.png',
                height: 53,
                width: 52,
                anchor: [0, 0],
                textColor: '#ffffff',
                textSize: 12
            }];
        }
        if(!this['marker_cluster_options']) {
            this.marker_cluster_options = {
                gridSize: 80,
                maxZoom: 8,
                styles: this.cluster_styles
            };
        }

        if(this.enable_marker_cluster) {
            this.marker_cluster = new MarkerClusterer(this.map, [], this.marker_cluster_options);
        }
    },
    build_markers: function(data) {
        this.clear_markers();
        this.markers = [];
        this.info_windows = [];
        for (var i=0; i < data.length; i++) {
            // if marker is somewhere in the middle of the ocean, its propably not defined
            if(!data[i].lat && !data[i].lng)
                continue;
            var marker = this.create_marker(data[i]);
            var info_window = this.create_info_window(marker, data[i].detail_text);
            this.markers.push(marker);
            this.info_windows.push(info_window);
            data[i].marker  = marker;
            data[i].info_window  = info_window;
        }
        this.visible_markers = this.markers;
        this.add_click_listener();

        if(this.enable_marker_cluster) {
            this.build_clusters();
        }
    },
    clear_markers: function() {
        if(this.markers) {
            for(var key in this.markers)
                this.markers[key].setMap(null);
            this.markers = null;
        }
        if(this.marker_cluster)
            this.marker_cluster.clearMarkers();
    },
    build_clusters: function() {
        this.marker_cluster.clearMarkers();
        this.marker_cluster.addMarkers(this.visible_markers);
    },
    create_marker: function(location) {
            var marker = new google.maps.Marker({
            position: new google.maps.LatLng(location.lat, location.lng),
            map: this.map,
            title: location.name,
            icon: location.icon
        });
        return marker;
    },
    create_info_window: function(marker, text) {
        return new google.maps.InfoWindow({
            content: text
        });
    },
    add_click_listener: function() {
        $(this.markers).each($.proxy(function(key, value) {
            google.maps.event.addListener(value, 'click', $.proxy(function(event) {
                if(this.info_window) {
                    this.info_window.close();
                }
                var info_window = this.info_windows[$(this.markers).index(value)];
                info_window.open(this.map, value);
                this.info_window = info_window;
                this.center_to_markers([value]);
            }, this));

            google.maps.event.addListener(value, 'mouseover', function() {
                for(var key in this.markers) {
                    this.markers[key].setOpacity(0.7);
                    this.markers[key].setZIndex(5);
                }

                value.setOpacity(1);
                value.setZIndex(10);
            });

            google.maps.event.addListener(value, 'mouseout', function() {
                for(var key in this.markers) {
                    this.markers[key].setOpacity(1);
                }
            });
        }, this));
    },
    open_marker: function(store) {
        this.close_last_info_window();
        store.info_window.open(this.map, store.marker);
        this.info_window = store.info_window;
    },
    close_last_info_window: function() {
        if(this.info_window) {
            this.info_window.close();
        }
    },
    get_location_with_offset: function(position) {
        return new google.maps.LatLng(position.lat() + 0.02, position.lng());
    },
    get_location: function(search_options, callback, error_callback) {
        var address = search_options.location;
        var geocoder = new google.maps.Geocoder();
        geocoder.geocode({'address': address}, $.proxy(function(results, status) {
          if (status == google.maps.GeocoderStatus.OK) {
            if(callback) {
                callback(results[0].geometry.location);
            }
          } else {
            if(error_callback)
                error_callback();
          }
        }, this));
    },
    set_zoom: function(zoom_level) {
        if(zoom_level === 'detail') {
            this.map.setZoom(this.zoome_levels.detail);
        }
        else if(typeof(zoom_level == 'number')) {
            this.map.setZoom(zoom_level);
        }
    },
    set_center: function(location) {
         this.map.setCenter(location);
    },
    fitBounds: function() {
        this.center_to_markers(this.markers);
    },
    center_to_markers: function(markers) {
        var bounds = new google.maps.LatLngBounds();

        $(markers).each(function(key, value) {
            bounds.extend(value.getPosition());
        });
        if(this.current_location_marker)
            bounds.extend(this.current_location_marker.getPosition());
        this.map.setCenter(bounds.getCenter());

        if(this.fitOffset) {
            var extendPoint1 = new google.maps.LatLng(bounds.getNorthEast().lat() + this.fitOffset, bounds.getNorthEast().lng() + this.fitOffset);
            var extendPoint2 = new google.maps.LatLng(bounds.getNorthEast().lat() - this.fitOffset, bounds.getNorthEast().lng() - this.fitOffset);
            bounds.extend(extendPoint1);
            bounds.extend(extendPoint2);
        }

        this.map.fitBounds(bounds);
    },
    wget_geolocation: function(callback) {
        // Try W3C Geolocation (Preferred)
        if(navigator.geolocation) {
            navigator.geolocation.getCurrentPosition($.proxy(function(position) {
                var location = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
                this.add_current_marker(location);
                if(callback)
                    callback(location, true);
        }, this), $.proxy(function() {
          }, this));
        }
        else {
        }
    },
    is_geolocation_available: function() {
        return navigator.geolocation !== undefined;
    },
    add_current_marker: function(location) {
        if(this.current_location_marker)
            this.current_location_marker.setMap(null);
        this.current_location_marker = new google.maps.Marker({
            position: location,
            map: this.map
        });
    },
    get_nearest_destinations: function(location, search_radius_input) {
        var lat = location.lat();
        var lng = location.lng();
        var pi = Math.PI;
        var R = 6371; // equatorial radius
        var nearest_destinations = [];
        var search_r = this.initial_search_radius;
        if(search_radius_input)
            search_r = search_radius_input;
        for(i = 0; i < this.visible_markers.length; i++) {
            var lat2 = this.visible_markers[i].position.lat();
            var lon2 = this.visible_markers[i].position.lng();

            var ch_lat = lat2 - lat;
            var ch_lon = lon2 - lng;

            var dLat = ch_lat * (pi / 180);
            var dLon = ch_lon * (pi / 180);

            var rLat1 = lat * (pi / 180);
            var rLat2 = lat2 * (pi / 180);

            var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(rLat1) * Math.cos(rLat2);
            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            var d = R * c;

            if(d < search_r) {
                nearest_destinations.push(this.visible_markers[i]);
            }
        }
        if(nearest_destinations.length < 2 && search_r < this.max_search_radius) {
            this.zoom -= 1;
            var new_search_r = search_r + this.search_radius_steps;
            nearest_destinations = this.get_nearest_destinations(location, new_search_r);
        }
        this.sort_stores_by_dest(nearest_destinations);
        return nearest_destinations;
    },
    sort_stores_by_dest: function(list) {
        list.sort(function(a, b) {
            return a.distance - b.distance;
        });
        return list;
    }
};


function Storefinder(options) {
    this.stores_open_marker_links = null;
    this.google_maps = null;
    this.ready_for_search = false;
    this.stores = [];
    this.is_mobile = false;
    this.map_canvas = null;
    this.num_results_div = null;

    for(var key in options)
        this[key] = options[key];
}

Storefinder.prototype = {
    init: function() {
        this.init_actions();

        if(this.stores)
            this.google_maps.build_markers(this.stores);
    },
    init_actions: function() {
        if(this['filter_inputs']) {
            var input_change_handler = function() {
                this.filter_stores();
            };
            for(var key in this.filter_inputs) {
                this.filter_inputs[key].change($.proxy(input_change_handler, this));
            }
        }
        if(this['nearby_btn']) {
            this.nearby_btn.click($.proxy(function(event) {
                event.preventDefault();
                this.google_maps.close_last_info_window();
                this.google_maps.wget_geolocation($.proxy(this.search_by_location, this));
            }, this));
        }
    },
    load_stores: function(url, callback) {
        $.getJSON(url, $.proxy(function(data) {
            this.google_maps.build_markers(data);
            this.stores = data;
            if(callback)
                callback();
        }, this));
    },
    filter_stores: function() {
        var filters = [];
        var filter, key;
        for(key in this.filter_inputs) {
            filters[this.filter_inputs[key].prop('name')] = this.filter_inputs[key].prop('checked').toString();
        }
        var filtered_stores = [];
        var match;
        for(var i = 0; i < this.stores.length; i++) {
            match = false;
            for(key in filters) {
                if(this.stores[i][key] == filters[key]) {
                    match = true;
                    break;
                }
            }
            if(match)
                filtered_stores.push(this.stores[i]);
        }
        this.google_maps.build_markers(filtered_stores);
    },
    show_store_detail: function(store) {
            this.google_maps.set_zoom('detail');
            this.google_maps.open_marker(store);
            this.google_maps.set_center(store.marker.getPosition());
    },
    search_by_location_str: function(location_str) {
        var store = this.get_store_by_name(location_str);
        if(store) {
            this.show_store_detail(store);
        }
        else {
            this.google_maps.get_location({
                'location': location_str
                },
                $.proxy(function(location) {
                    this.search_by_location(location, true);
            }, this),
                $.proxy(function(location) {
                        this.num_results_div.html(MAP_TEXTS.no_results);
                }, this));
        }
    },
    search_by_location: function(location) {
        var markers = this.google_maps.get_nearest_destinations(location);
        this.google_maps.add_current_marker(location);
        this.google_maps.center_to_markers.call(this.google_maps, markers);
    },
    // in stores list
    add_click_listener: function(stores) {
        $(stores).each($.proxy(function(key, value) {
            $(value.open_marker_link).click($.proxy(function(event) {
                event.preventDefault();
                for(var i = 0; i < stores.length; i++) {
                    if($(stores[i].open_marker_link).attr('id') == $(event.currentTarget).attr('id')) {
                        this.google_maps.open_marker(stores[i]);
                        this.google_maps.center_to_markers([stores[i].marker]);
                        break;
                    }
                }
            }, this));
        }, this));
    },
    get_store_by_name: function(name) {
        for(var key in this.stores) {
            if(this.stores[key].name.toLowerCase() == name.toLowerCase()) {
                return this.stores[key];
            }
        }
        return null;
    },
};
