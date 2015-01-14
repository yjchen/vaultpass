"use strict";

// This fixes a bug in Chrome where the popup is not sized correctly.
function fixSize() {
  setInterval(function() {
    var width = $('#container').width();
    var height = $('#container').height();
    $('#container').width(width);
    $('#container').height(height);
  }, 100);
}

$(function() {
  // Get the current tab.
  chrome.tabs.query({
      active: true,
      currentWindow: true
    }, function(tabs) {
      // Make sure we got the tab.
      if (tabs.length !== 1) {
        $('#controls').addClass('hidden');
        $('#error').removeClass('hidden').text('Unable to determine active tab.');
        $('#container').removeClass('hidden');
        fixSize();
        return;
      }

      // Get the domain.
      var domain = null;
      var matches = tabs[0].url.match(/^http(?:s?):\/\/([^/]*)/);
      if (matches) {
        domain = matches[1].toLowerCase();
      } else {
        // Example cause: files served over the file:// protocol.
        $('#controls').addClass('hidden');
        $('#error').removeClass('hidden').text('Unable to determine the domain.');
        $('#container').removeClass('hidden');
        fixSize();
        return;
      }
      if (/^http(?:s?):\/\/chrome\.google\.com\/webstore.*/.test(tabs[0].url)) {
        // Technical reason: Chrome prevents content scripts from running in the app gallery.
        $('#controls').addClass('hidden');
        $('#error').removeClass('hidden').text('Hashpass cannot run in the Chrome Web Store.');
        $('#container').removeClass('hidden');
        fixSize();
        return;
      }
      $('#domain').val(domain);
      


      // Run the content script to register the message handler.
      chrome.tabs.executeScript(tabs[0].id, {
        file: 'content_script.js'
      }, function() {
        // Check if a password field is selected.
        chrome.tabs.sendMessage(tabs[0].id, {
            type: 'check'
          }, function(response) {
            // Different user interfaces depending on whether a password field is in focus.
            var passwordMode = (response.type === 'password');
            if (passwordMode) {
              $('.password-mode-off').addClass('hidden');
              $('.password-mode-on').removeClass('hidden');
            } else {
              $('.password-mode-off').removeClass('hidden');
              $('.password-mode-on').addClass('hidden');
            }
            $('#error').addClass('hidden');
            $('#container').removeClass('hidden');
            fixSize();

            // Called whenever the key changes.
            var update = function() {
              var domain = $('#domain').val();
              var key = $('#key').val();
              var choice = $('input[type=radio]:checked').attr('id');
              var settings  = window[choice];
              settings['phrase'] = key;

              var hash = new Vault(settings).generate(domain);
              $('#hash').val(hash);
              return hash;
            };
            
            $('input').on('ifChecked', function(event){
              update();
            });
            
            $('input').iCheck({
              checkboxClass: 'icheckbox_square-red',
              radioClass: 'iradio_square-red',
              increaseArea: '20%' // optional
            });

            $('#hash').focus(function(event_details) {
              $(this).select();
            });

            // A debounced version of update().
            var timeout = null;
            var debouncedUpdate = function() {
              if (timeout !== null) {
                clearInterval(timeout);
              }
              timeout = setTimeout((function() {
                update();
                timeout = null;
              }), 100);
            }

            if (passwordMode) {
              // Listen for the Enter key.
              $('#key').keydown(function(e) {
                if (e.which === 13) {
                  // Try to fill the selected password field with the hash.
                  chrome.tabs.sendMessage(tabs[0].id, {
                      type: 'fill',
                      hash: update()
                    }, function(response) {
                      // If successful, close the popup.
                      if (response.type === 'close') {
                        window.close();
                      }
                    }
                  );
                }
              });
            }

            if (!passwordMode) {
              // Register the update handler.
              $('#key').bind('propertychange change click keyup input paste', debouncedUpdate);
              $('#domain').bind('propertychange change click keyup input paste', debouncedUpdate);
            }

            // Update the hash right away.
            debouncedUpdate();

            // Focus the text field.
            $('#key').focus();
          }
        );
      });
    }
  );
});
