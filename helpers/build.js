'use strict';

var parse = require('./parse.js'),
    patterns = require('./patterns.js'),
    time = require('./time.js'),
    sortBy = require('./sortby.js'),
    fs = require('fs-extra'),
    path = require('path'),
    yaml = require('yamljs');

var loadSections = function () {
  return yaml.load('./config/sections.yml');
}

//////////////////////////////
// Build the File listing
//////////////////////////////
var buildFileJSON = function (directory, extensions, cb) {
  var start = process.hrtime();

  // console.log(directory);

  parse.files(directory, extensions, function (files) {
    var output = {};

    // // Create an array for each section
    // sections.forEach(function (section) {
    //   output[section] = [];
    // });

    // console.log(output);

    // Loop over each file and push its pattern into the section
    files.forEach(function (file) {
      if (extensions.indexOf(path.extname(file)) >= 0 ) {
        var pattern = patterns.info(file),
            section = pattern.section;


        // console.log(pattern);

        // console.log(section);
        // Push the pattern into the correct section
        if (!output[section]) {
          output[section] = [];
        }

        output[section].push(pattern);
      }
    });

    // Display elapsed time
    time.elapsed(start, 'build.fileJSON');
    return cb(output);
  });
}

//////////////////////////////
// Build the Menu
//////////////////////////////
var buildMenuJSON = function (directory, extensions, all, cb) {
  var start = process.hrtime(),
      sections = loadSections(),
      folderHolder = {},
      folderReverse = {},
      folderSort = {},
      output = [];

  // Get the files and folders
  parse.folders(directory, function (folders) {

    // Builds basic folder information
    folders.forEach(function (v) {

      var pattern = patterns.info(v);
      var id = pattern.id;
      var group = pattern.group;
      if (pattern.section !== pattern.id) {
        id = pattern.section + '-' + pattern.id
        group = pattern.section;
        if (pattern.group !== '') {
          group +=  '-' + pattern.group;
        }
      }

      folderHolder[id] = {
        title: pattern.title,
        group: group,
        submenu: [],
        all: []
      };

      if (pattern.section === pattern.id) {
        folderHolder[id].all.push({
          title: 'View All',
          href: '#/' + pattern.id
        });
      }
      // If we're in a subsection, make sure it's prefixed
      else {
        folderHolder[id].all.push({
          title: 'View All',
          href: '#/' + pattern.section + '?group=' + pattern.id
        });
      }
    });


    parse.files(directory, extensions, function (files) {

      // Sorts files into their groups
      files.forEach(function (v) {
        var pattern = patterns.info(v);
        var item = {
          title: pattern.title,
          href: '#/' + pattern.section + '?id=' + pattern.id
        }


        if (pattern.group === '') {
          folderHolder[pattern.section].submenu.push(item);
        }
        else {
          folderHolder[pattern.section + '-' + pattern.group].submenu.push(item);
        }
      });


      // console.log(folderHolder);
      // Grab the core groups
      for (var k in folderHolder) {
        var folder = folderHolder[k];
        var group = folder.group;

        if (folder.group === '') {
          if (sections[k] && sections[k].title) {
            folder.title = sections[k].title;
          }
          else {
            folder.title = patterns.titleize(k);
          }
          // console.log(folder.title);
          folderSort[k] = folder;
          delete folderHolder[k];
        }
      }
      // Reverse the remaining
      var reverseKeys = Object.keys(folderHolder).reverse();
      reverseKeys.forEach(function (v) {
        folderReverse[v] = folderHolder[v];
      });

      // Deep Nested Items
      for (var k in folderReverse) {
        var folder = folderReverse[k];
        var group = folder.group;

        if (folderReverse[group]) {
          var subMenu = folder.submenu.sort(function (a, b) {
                return sortBy.title(a, b);
              });
          if (all) {
            subMenu = subMenu.concat(folder.all);
          };
          folderReverse[group].submenu.push({
            title: folder.title,
            submenu: subMenu
          });
          delete folderReverse[k];
        }
      }

      // First Level Items (below core folders)
      for (var k in folderReverse) {
        var folder = folderReverse[k];
        var group = folder.group;

        if (folderSort[group]) {
          var subMenu = folder.submenu.sort(function (a, b) {
                return sortBy.title(a, b);
              });
          if (all) {
            subMenu = subMenu.concat(folder.all);
          };
          folderSort[group].submenu.push({
            title: folder.title,
            submenu: subMenu
          });
        }
      }

      // Core folders
      for (var k in folderSort) {
        var folder = folderSort[k];
        var subMenu = folder.submenu.sort(function (a, b) {
              return sortBy.title(a, b);
            });
        if (all) {
          subMenu = subMenu.concat(folder.all);
        };

        if (folder.submenu.length) {
          output.push({
            title: folder.title,
            submenu: subMenu
          });
        }
      }

      time.elapsed(start, 'build.menuJSON');
      return cb(output);
    });
  });
}

//////////////////////////////
// Build Scope JSON
//////////////////////////////
var buildScopeJSON = function (cb) {
  var start = process.hrtime(),
      sections = loadSections(),
      scopes = {};

  Object.keys(sections).forEach(function (v) {
    fs.existsSync
    var path = './' + v + '/' + v +'.yml';
    if (fs.existsSync(path)) {
      var load = yaml.load('./' + v + '/' + v +'.yml');
      if (load[v] !== undefined) {
        scopes[v] = load[v];
      }
    }
  });

  time.elapsed(start, 'build.scopeJSON');
  return cb(scopes);
}

var buildPagesJSON = function (directory, cb) {
  var output = [];

  parse.pages(directory, function (pages) {
    pages.forEach(function (page) {
      var load = yaml.load('./' + directory + '/' + page),
          pattern = patterns.info(page);

      delete pattern.path;
      if (load !== undefined) {
        pattern.content = load;
        output.push(pattern);
      }
    });

    return cb(output);
  });
}

var buildMenu = function (sp__paths, cb) {
  var done = false;
  buildMenuJSON(sp__paths.partials, ['.html'], true,  function (menu) {
    if (done === false) {
      done = menu;
    }
    else {
      menu = menu.concat(done);
      return cb(menu);
    }
  });

  buildMenuJSON(sp__paths.server + sp__paths.demos, ['.json'], false, function (pages) {

    if (done === false) {
      done = pages;
    }
    else {
      done = done.concat(pages);
      return cb(done);
    }

  });
}

//////////////////////////////
// Exports
//////////////////////////////
module.exports.loadSections = loadSections;
module.exports.fileJSON = buildFileJSON;
module.exports.menuJSON = buildMenuJSON;
module.exports.scopeJSON = buildScopeJSON;
module.exports.pagesJSON = buildPagesJSON;
module.exports.menu = buildMenu;
