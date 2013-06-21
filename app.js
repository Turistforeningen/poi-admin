(function() {
  "use strict";  
  jQuery(function($) {
    var topo = L.tileLayer('http://opencache.statkart.no/gatekeeper/gk/gk.open_gmaps?layers=topo2&zoom={z}&x={x}&y={y}', {
      maxZoom: 16,
      attribution: '<a href="http://www.statkart.no/">Statens kartverk</a>'
    });
    var cache = []; 
    var map = new L.Map('map', {layers: [topo], center: new L.LatLng(60.389444, 5.33), zoom: 13 });
    var api = window.location.hash.substr(1) || 'localhost';
    var api = 'http://' + api + '/stedsbase/steder/';
    var pois = new L.GeoJSON(null, {
      onEachFeature: function (feature, layer) {
        cache[feature.properties.id] = layer;
        layer.bindPopup('');
        
        if (!layer.feature.properties.tags) {
          layer.feature.properties.tags = '21';
        }
        
        layer._setPopup = function() {
          this._popup.setContent([
            '<strong class="poi-title">'+(this.feature.properties.title || 'Uten Navn')+'</strong><br>'
            ,'<a href="#" class="poi-move">Flytt</a>'
            ,' | <a href="#" class="poi-edit">Endre</a>'
            ,' | <a href="#" class="poi-delete">Slett</a>'
          ].join(''));
        }
        
        layer._save = function(data) {
          $.getJSON(api + this.feature.properties.id + '/' + data, function(data) {
            console.log(data);
          });
        }
        
        layer._delete = function() {
          this._save([
            '?method=del'
            ,'callback=?'
          ].join('&'));
          pois.removeLayer(this);
        }
        
        layer._saveLatlng = function() {
          this._save([
            '?method=put'
            ,'lat='      + this.getLatLng().lat
            ,'lon='      + this.getLatLng().lng
            ,'callback=?'
          ].join('&'));
        }
        
        layer._saveProps = function() {
          this._save([
            '?method=put'
            ,'navn='     + this.feature.properties.title
            ,'tags='     + this.feature.properties.tags
            ,'callback=?'
          ].join('&'));
          this._setIcon();
          this._setPopup();
          this.closePopup();
        }
        
        layer._setIcon = function() {
          var type = this.feature.properties.tags.split('|')[0];
          this.setIcon(L.icon({
            iconUrl: 'img/poi/' + type + '.png'
            ,iconRetinaUrl: 'img/poi/' + type + '@2x.png'
            ,iconSize: [26, 32]
            ,iconAnchor: [13, 32]
            ,popupAnchor: [-0, -30]
          }));
        }
        
        layer.on('dragend', function() {
          this._saveLatlng();
          this.dragging.disable();
        });
        
        layer._setPopup();
        layer._setIcon();
      }
    }).addTo(map);
    
    map.on('popupopen', function(e) {      
      $('div.leaflet-popup .poi-move').on('click', function(event) {
        event.preventDefault();
        e.popup._source.dragging.enable();
        e.popup._source.closePopup();
      });
      $('div.leaflet-popup .poi-edit').on('click', function(event) {
        event.preventDefault();
        openModal(e.popup._source.feature.properties.id);
      });
      $('div.leaflet-popup .poi-delete').on('click', function(event) {
        event.preventDefault();
        if (confirm("Ønsker du virkelig å slette dette stedet?")) {
          e.popup._source._delete();
        }
      });
      $('#modal button.btn-primary').on('click', function(event) {
        closeModal();
      });
    });
    
    map.on('popupclose', function(e) {
      $('div.leaflet-popup .poi-move').off('click');
      $('div.leaflet-popup .poi-edit').off('click');
      $('div.leaflet-popup .poi-delete').off('click');
      $('#modal button.btn-primary').off('click');
    });

    var openModal = function(id) {
      var data = cache[id].feature.properties;
      var tags = data.tags.split('|');
                  
      $('#modal input[name=poi_id]').val(data.id);
      $('#modal input[name=poi_title]').val(data.title);
      //$('#modal input[name=poi_desc]').val(data.desc);
      
      $('.selectpicker').selectpicker('deselectAll');
      $('#modal select[name=poi_type]').selectpicker('val', tags[0]);
      $('#modal select[name=poi_type2]').selectpicker('val', tags.slice(1));
      
      $('#modal').modal('show');
    }
    
    var closeModal = function() {
      var marker = cache[$('#modal input[name=poi_id]').val()];
      
      var title = $('#modal input[name=poi_title]').val();
      var desc = $('#modal input[name=poi_desc]').val();
      var type1 = [$('#modal select[name=poi_type]').val()];
      var type2 = $('#modal select[name=poi_type2]').val();
      if (type2 === null || type2.length === 0) {
        var tags = type1[0];
      } else {
        var tags = type1.concat(type2).join('|');
      }
      
      marker.feature.properties.tags = tags;
      marker.feature.properties.title = title;
      marker.feature.properties.desc = desc;
      
      marker._saveProps();
      
      $('#modal').modal('hide');
    }
        
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
