(function() {
  "use strict";  
  jQuery(function($) {
    var topo = L.tileLayer('http://opencache.statkart.no/gatekeeper/gk/gk.open_gmaps?layers=topo2&zoom={z}&x={x}&y={y}', {
      maxZoom: 16,
      attribution: '<a href="http://www.statkart.no/">Statens kartverk</a>'
    });
    var cache = {}; 
    var map = new L.Map('map', {layers: [topo], center: new L.LatLng(60.389444, 5.33), zoom: 13 });
    var api = window.location.hash.substr(1) || 'localhost';
    var api = 'http://' + api + '/stedsbase/steder/';
    var pois = new L.GeoJSON(null, {
      onEachFeature: function (feature, layer) {
        layer.bindPopup('');
        layer._modifiedData = [];
        
        if (!layer.feature.properties.tags) {
          layer.feature.properties.tags = '21';
        }
        
        /**
         * Set Popup
        */
        layer._setPopup = function() {
          this._popup.setContent([
            '<strong class="poi-navn">'+(this.get('navn') || 'Uten Navn')+'</strong><br>'
            ,'<a href="#" class="poi-move">Flytt</a>'
            ,' | <a href="#" class="poi-edit">Endre</a>'
            ,' | <a href="#" class="poi-delete">Slett</a>'
          ].join(''));
          this.closePopup();
        }
        
        /**
         * Set Icon
        */
        layer._setIcon = function() {
          var type = this.get('tags').split('|')[0];
          this.setIcon(L.icon({
            iconUrl: 'img/poi/' + type + '.png'
            ,iconRetinaUrl: 'img/poi/' + type + '@2x.png'
            ,iconSize: [26, 32]
            ,iconAnchor: [13, 32]
            ,popupAnchor: [-0, -30]
          }));
        }
        
        /**
         * Delete POI
        */
        layer.delete = function(cb) {
          $.getJSON(api + this.get('id') + '/?method=del&callback=?', function(data) {
            if (typeof cb === 'function') {
              cb(data);
            }
          });
          pois.removeLayer(this);
        }
        
        /**
         * Save POI
        */
        layer.save = function() {
          if (this._modifiedData.length === 0) {
            this._saveDesc();
            return;
          }
          
          var i, data, $this;
          
          $this = this;
          
          if (this.get('id') === '') {
            this._modifiedData = ['navn', 'tags', 'obj_type', 'lat', 'lon'];
          }
          
          data = '';
          for (var i = 0; i < this._modifiedData.length; i++) {
            if (layer._modifiedData[i] === 'tags') {
              this._setIcon();
            } else if (layer._modifiedData[i] === 'navn') {
              this._setPopup();
            }
            data += '&' + layer._modifiedData[i] + '=' + this.get(layer._modifiedData[i]);
          }
          data += '&callback=?'
          
          
          if (this.get('id') !== '') {
            this._saveUpdate(data, function(data) {
              $this._saveDesc();
            });
          } else {
            this._saveInsert(data, function(data) {
              $this._saveDesc();
            });
          }
          
          this._modifiedData = [];
        }
        
        /**
         * Save Update
        */
        layer._saveUpdate = function(data, cb) {
          data = '?method=put' + data;
          
          $.getJSON(api + this.get('id') + '/' + data, function(data) {
            cb(data);
          });
        }
        
        /**
         * Savve Insert
        */
        layer._saveInsert = function(data, cb) {
          data = '?method=post' + data;
          
          var $this = this;
          
          $.getJSON(api + data, function(data) {
            $this.set('id', data.rows[0].id);
            cache[data.rows[0].id] = $this;
            
            cb(data);
          });
        }
        
        /**
         * Get property data
         *
         * @param key -
         *
         * @return String
        */
        layer.get = function(key) {
          return this.feature.properties[key];
        }
        
        layer.getDesc = function(cb) {
          var $this = this;
          // todo check if desc exists
          if (this.get('id') !== '') {
            $.getJSON(api + this.get('id') + '/tekster/?callback=?', function(data) {
              if (data.rows.length > 0) {
                $this.feature.properties.desc = data.rows[0].tekst;
                $this.feature.properties.descId = data.rows[0].id;
                $this.feature.properties.descModified = false;
                cb(data.rows[0].tekst);
              } else {
                $this.feature.properties.desc = '';
                $this.feature.properties.descId = null;
                $this.feature.properties.descModified = false;            
                cb('');
              }
            });
          } else {
            this.feature.properties.desc = '';
            this.feature.properties.descId = null;
            this.feature.properties.descModified = false;            
            cb('');
          }
        }
        
        layer.setDesc = function(val, cb) {
          if (this.feature.properties.desc === val) { return; }
          
          this.feature.properties.desc = val;
          this.feature.properties.descModified = true;
        }
        
        layer._saveDesc = function() {
          if (!this.feature.properties.descModified) { return; }
          
          var id = this.feature.properties.descId;
          var desc = this.feature.properties.desc;
          
          if (this.feature.properties.descId !== null) {
            $.getJSON(api + this.get('id') + '/tekster/' + id +'/?method=put&tekst=' + desc + '&callback=?', function(data) {
              if (typeof cb === 'function') {
                cb(data);
              }
            });
          } else {
            $.getJSON(api + this.get('id') + '/tekster/?method=post&tekst=' + desc + '&callback=?', function(data) {
              if (typeof cb === 'function') {
                cb(data);
              }
            });
          }          
        }
        
        /**
         * Set property data
         *
         * Should not be used for setting description
         *
         * @param key -
         * @param val - 
        */
        layer.set = function(key, val) {
          if (this.feature.properties[key] !== val) {
            this.feature.properties[key] = val;
            if (key !== 'id' && key !== 'desc') {
              this._modifiedData.push(key);
            }
          }
        }                
        
        layer.on('dragend', function() {
          this.set('lat', this.getLatLng().lat)
          this.set('lon', this.getLatLng().lng)
          this.save();          
          this.dragging.disable();
        });
        
        layer._setPopup();
        layer._setIcon();
        
        if (layer.get('id') !== '') {
          cache[layer.get('id')] = layer;
        } else {
          openModal(layer);
        }
        
      }
    }).addTo(map);
    
    $('#modal button.btn-primary').on('click', function(event) {
      closeModal();
    });
    
    map.on('popupopen', function(e) {      
      $('div.leaflet-popup .poi-move').on('click', function(event) {
        event.preventDefault();
        e.popup._source.dragging.enable();
        e.popup._source.closePopup();
      });
      $('div.leaflet-popup .poi-edit').on('click', function(event) {
        event.preventDefault();
        openModal(cache[e.popup._source.feature.properties.id]);
      });
      $('div.leaflet-popup .poi-delete').on('click', function(event) {
        event.preventDefault();
        if (confirm("Ønsker du virkelig å slette dette stedet?")) {
          e.popup._source.delete();
        }
      });
    });
    
    map.on('popupclose', function(e) {
      $('div.leaflet-popup .poi-move').off('click');
      $('div.leaflet-popup .poi-edit').off('click');
      $('div.leaflet-popup .poi-delete').off('click');
    });

    /** 
     * Open modal
    */
    var lastMarker = null;
    var openModal = function(marker) {
      lastMarker = marker;
      
      var tags = marker.get('tags').split('|');
                  
      $('#modal input[name=poi_id]').val(marker.get('id'));
      $('#modal input[name=poi_navn]').val(marker.get('navn'));
      marker.getDesc(function(desc) {
        $('#modal textarea[name=poi_desc]').val(desc);
      });
      
      $('.selectpicker').selectpicker('deselectAll');
      $('#modal select[name=poi_type]').selectpicker('val', tags[0]);
      $('#modal select[name=poi_type2]').selectpicker('val', tags.slice(1));
      
      $('#modal').modal('show');
    }
    
    /**
     * Close modal
    */
    var closeModal = function() {
      var marker = lastMarker;
      
      var navn = $('#modal input[name=poi_navn]').val();
      var desc = $('#modal textarea[name=poi_desc]').val();
      var type1 = [$('#modal select[name=poi_type]').val()];
      var type2 = $('#modal select[name=poi_type2]').val();
      if (type2 === null || type2.length === 0) {
        var tags = type1[0];
      } else {
        var tags = type1.concat(type2).join('|');
      }
      
      marker.set('tags', tags);
      marker.set('navn', navn);
      marker.setDesc(desc);
      
      marker.save();
      
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
                    ,navn: data.rows[i].navn
                    ,obj_type: data.rows[i].obj_type
                    ,tags: data.rows[i].tags
                    ,lat: data.rows[i].lat
                    ,lon: data.rows[i].lon
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
        ,marker : {
          icon: L.icon({
            iconUrl: 'img/poi/21.png'
            ,iconRetinaUrl: 'img/poi/21@2x.png'
            ,iconSize: [26, 32]
            ,iconAnchor: [13, 32]
            ,popupAnchor: [-0, -30]
          })
        }
      }
      ,edit: null
    });
    map.addControl(drawControl);
    
    map.on('draw:created', function (e) {
      pois.addData({
        type: "Point"
        ,coordinates: [e.layer._latlng.lng, e.layer._latlng.lat]
        ,properties: {
          id: ''
          ,navn: ''
          ,obj_type: 'ETA-POI'
          ,tags: '21'
          ,lat: e.layer._latlng.lat
          ,lon: e.layer._latlng.lng
        }
      });
    });    
  });    
}).call(this);
