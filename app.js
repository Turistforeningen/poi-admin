(function() {
  "use strict";  
  jQuery(function($) {
    $('.selectpicker').selectpicker();
    
    var topo = L.tileLayer('http://opencache.statkart.no/gatekeeper/gk/gk.open_gmaps?layers=topo2&zoom={z}&x={x}&y={y}', {
      maxZoom: 16,
      attribution: '<a href="http://www.statkart.no/">Statens kartverk</a>'
    });
    var cache = []; 
    var map = new L.Map('map', {layers: [topo], center: new L.LatLng(60.389444, 5.33), zoom: 13 });
    var api = window.location.hash.substr(1) || 'localhost';
    var api = 'http://' + api + '/stedsbase/steder/';
    var pois = new L.GeoJSON(null, {
      pointToLayer: function(featureData, latlng) {
        var type = featureData.properties.tags.split('|')[0] || 21
        return new L.Marker(latlng, {
          icon: L.icon({
            iconUrl: 'img/poi/' + type + '.png'
            ,iconRetinaUrl: 'img/poi/' + type + '@2x.png'
            ,iconSize: [26, 32]
            ,iconAnchor: [13, 32]
            ,popupAnchor: [-0, -30]
          })
        });
      }
      ,onEachFeature: function (feature, layer) {
        cache[feature.properties.id] = layer;
        
        var content = [
          '<strong class="poi-title">'+(feature.properties.title || 'Uten Navn')+'</strong><br>'
          ,'<a href="#" class="poi-move">Flytt</a>'
          ,' | <a href="#" class="poi-edit">Endre</a>'
          ,' | <a href="#" class="poi-delete">Slett</a>'
        ].join('');
        
        layer.bindPopup(content);
      }
    }).addTo(map);
    
    map.on('popupopen', function(e) {      
      $('div.leaflet-popup .poi-move').on('click', function(event) {
        event.preventDefault();
      });
      $('div.leaflet-popup .poi-edit').on('click', function(event) {
        event.preventDefault();
        openModal(e.popup._source.feature.properties.id);
      });
      $('div.leaflet-popup .poi-delete').on('click', function(event) {
        event.preventDefault();
      });
    });
    
    /**
     * Open Modal
    */
    var openModal = function(id) {
      var data = cache[id].feature.properties;
      var tags = data.tags.split('|');
      
      console.log(data);

      $('#modal select[name=poi_type] option:selected').removeAttr('selected');
      $('#modal select[name=poi_type2] option:selected').removeAttr('selected');

      $('#modal input[name=poi_title]').val(data.title);
      $('#modal select[name=poi_type] option[value='+tags[0]+']').attr('selected', 'selected');
      for (var i = 1; i < tags.length; i++) {
        console.log(i, tags[i], $('#modal select[name=poi_type2] option[value='+tags[i]+']').html());
        $('#modal select[name=poi_type2] option[value='+tags[i]+']').attr('selected', 'selected');
      }
      
      $('.selectpicker').selectpicker('refresh');
      $('#modal').modal('show');
    }
    
    map.on('popupclose', function(e) {
      $('div.leaflet-popup .poi-move').off('click');
      $('div.leaflet-popup .poi-edit').off('click');
      $('div.leaflet-popup .poi-delete').off('click');
    });
    
    map.on('moveend', function() {
      if (map.getZoom() >= 11) {
        $.getJSON(api + '?limit=1000&bbox=' + map.getBounds().toBBoxString() + '&callback=?', function(data) {
          if (data.rows) {
            var i;
            for(i in data.rows) {
              if (typeof cache[data.rows[i].id] === 'undefined') {
                pois.addData({
                  type: "Point"
                  ,coordinates: [data.rows[i].lon, data.rows[i].lat]
                  ,properties: {
                    id: data.rows[i].id
                    ,title: data.rows[i].navn
                    ,type: data.rows[i].obj_type
                    ,tags: data.rows[i].tags
                    ,tags_old: data.rows[i].gamletagger
                  }
                });
              }
            }
          }
        });
      } else {
        pois.clearLayers();
      }
    });
    map.fire('moveend');
    
    var drawControl = new L.Control.Draw({
      draw: {
        position  : 'topleft'
        ,polyline  : null
        ,circle    : null
        ,rectangle : null
        ,polygon   : null
      }
      ,edit: null
    });
    map.addControl(drawControl);
    
    map.on('draw:created', function (e) {
      console.log(e);
      
      /*
      data = {
        'name': 'Uten navn',
        'geom': latlngsToString(e.layer._latlngs)
      };
      
      $.post(areaUrl + '&method=post', data, function(data) {
        return myPolygons.addData(data);
      });
      */
      
    });    
  });    
}).call(this);
