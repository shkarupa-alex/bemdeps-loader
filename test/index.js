const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const expect = require('expect.js');
const bemPath = require('../lib/bem-path');
const bemDeps = require('@bem/deps');
const depsForDeps = require('../lib/deps-for-deps');
const resolveDeps = require('../lib/resolve-deps');
const runWebpack = require('./helpers/run-webpack');
const watchWebpack = require('./helpers/watch-webpack');

describe('bem-path', () => {
  it('should pass simple blocks', () => {
    const dep = {block: 'page'};

    const result = bemPath(dep, 'js');
    expect(result).to.be(path.join('page', 'page.js'));
  });

  it('should resolve paths like @bem/fs-scheme +nested +original', () => {
    const dep = {
      block: 'page',
      elem: 'script',
      mod: {
        name: 'async',
        val: 'yes',
      },
    };

    const result = bemPath(dep, 'js', 'blocks.common');
    expect(result).to.be(path.join('blocks.common', 'page', '__script',
      '_async', 'page__script_async_yes.js'));
  });
});

describe('deps-for-deps', () => {
  it('should produce expected output', () => {
    const deps = {
      styles: [
        {
          block: 'page',
        },
        {
          block: 'page',
          elem: 'script',
        },
        {
          block: 'img',
          mod: {
            name: 'lightbox',
            val: true,
          },
        },
      ],
    };

    const result = depsForDeps(deps, [
      'test/levels/blocks.01',
      'test/levels/blocks.09',
      'test/levels/blocks.09',
    ]).map((p) => {
      return p.split('bemdeps-loader')[1];
    });

    expect(result).to.be.an('array');
    expect(result.length).to.be(16);
    expect(result.indexOf('/test/levels/blocks.01')).to.be.above(-1);
    expect(result.indexOf('/test/levels/blocks.01/page')).to.be.above(-1);
    expect(result
      .indexOf('/test/levels/blocks.01/page/__script')).to.be.above(-1);
    expect(result
      .indexOf('/test/levels/blocks.01/page/__script/page__script.deps.js'))
      .to.be.above(-1);
  });

  it('should be fast', () => {
    const source = path.join(__dirname, 'cases', 'bemjson-speedtest',
      'source.bemdeps.json');
    const deps = require(source);

    const start = process.hrtime();
    depsForDeps(deps, [
      'test/levels/blocks.01',
      'test/levels/blocks.02',
      'test/levels/blocks.03',
      'test/levels/blocks.04',
      'test/levels/blocks.05',
      'test/levels/blocks.06',
      'test/levels/blocks.07',
      'test/levels/blocks.08',
      'test/levels/blocks.09',
      'test/levels/blocks.09',
      'test/levels/blocks.09',
      'test/levels/blocks.09',
    ]);
    const elapsed = process.hrtime(start);

    expect(elapsed).to.be.an('array');
    expect(elapsed[0]).to.be(0);
    expect(elapsed[1] / 1000000).to.be.below(50);
  });
});

describe('bem-deps', () => {
  it('should not fail with empty levels', () => {
    const levels = [];

    const declaration = [{block: 'page'}];

    const techMap = {
      styles: ['css', 'scss'],
      scripts: ['js', 'babel.js'],
      html: ['bh.js'],
    };

    return bemDeps.load({levels: levels}).then((relations) => {
      return resolveDeps(declaration, relations, techMap);
    }).then((relations) => {
      expect(relations).to.eql({
          'styles': [{block: 'page'}],
          'scripts': [{block: 'page'}],
          'html': [{block: 'page'}],
        }
      );
    });
  });

  it('should not fail with empty techs', () => {
    const levels = [
      'test/levels/blocks.base',
      'test/levels/blocks.plugins',
      'test/levels/blocks.common',
    ];

    const declaration = [{block: 'page'}];

    const techMap = {
      styles: [],
      scripts: [],
      html: [],
    };

    return bemDeps.load({levels: levels}).then((relations) => {
      return resolveDeps(declaration, relations, techMap);
    }).then((relations) => {
      expect(relations).to.eql({
          'styles': [
            {block: 'page'},
            {block: 'page', elem: 'script'},
            {block: 'ua'},
          ],
          'scripts': [
            {block: 'page'},
            {block: 'page', elem: 'script'},
            {block: 'ua'},
          ],
          'html': [
            {block: 'page'},
            {block: 'page', elem: 'script'},
            {block: 'ua'},
          ],
        }
      );
    });
  });

  it('should not fail with empty declarations', () => {
    const levels = [
      'test/levels/blocks.base',
      'test/levels/blocks.plugins',
      'test/levels/blocks.common',
    ];

    const declaration = [];

    const techMap = {
      styles: ['css', 'scss'],
      scripts: ['js', 'babel.js'],
      html: ['bh.js'],
    };

    return bemDeps.load({levels: levels}).then((relations) => {
      return resolveDeps(declaration, relations, techMap);
    }).then((relations) => {
      expect(relations).to.eql({
          'styles': [],
          'scripts': [],
          'html': [],
        }
      );
    });
  });

  it('should resolve deps fast', () => {
    const levels = [
      'node_modules/bem-core/common.blocks',
      'node_modules/bem-core/desktop.blocks',
      'node_modules/bem-components/common.blocks',
      'node_modules/bem-components/desktop.blocks',
      'node_modules/bem-components/design/common.blocks',
      'node_modules/bem-components/design/desktop.blocks',
      'test/levels/blocks.base',
      'test/levels/blocks.plugins',
      'test/levels/blocks.common',
    ];

    const source = path.join(__dirname, 'cases', 'bemjson-speedtest',
      'source.bemdecl.json');
    const declaration = require(source);

    const techMap = {
      styles: ['css', 'scss'],
      scripts: ['js', 'babel.js'],
      html: ['bh.js'],
    };

    let start;
    return bemDeps.load({levels: levels}).then((relations) => {
      start = process.hrtime();

      return resolveDeps(declaration, relations, techMap);
    }).then((relations) => {
      const elapsed = process.hrtime(start);

      expect(elapsed).to.be.an('array');
      expect(elapsed[0]).to.be(0);
      expect(elapsed[1] / 1000000).to.be.below(600); // TODO: make it more fast
    });
  });

  it('should resolve deps as expected', () => {
    const levels = [
      'test/levels/blocks.base',
      'test/levels/blocks.plugins',
      'test/levels/blocks.common',
    ];

    const declaration = [
      {block: 'page'},
      {block: 'img', modName: 'lightbox', modVal: true},
    ];

    const techMap = {
      styles: ['css', 'scss'],
      scripts: ['js', 'babel.js'],
      html: ['bh.js'],
    };

    return bemDeps.load({levels: levels}).then((relations) => {
      return resolveDeps(declaration, relations, techMap);
    }).then((relations) => {
      expect(relations).to.eql({
          'styles': [
            {block: 'page'},
            {block: 'page', elem: 'script'},
            {block: 'ua'},
            {block: 'jquery'},
            {block: 'lightbox'},
            {block: 'img'},
            {block: 'img', mod: {name: 'lightbox', val: true}},
            {block: 'ua', elem: 'modern'},
          ],
          'scripts': [
            {block: 'page'},
            {block: 'page', elem: 'script'},
            {block: 'ua'},
            {block: 'jquery'},
            {block: 'lightbox'},
            {block: 'img'},
            {block: 'img', mod: {name: 'lightbox', val: true}},
          ],
          'html': [
            {block: 'page'},
            {block: 'page', elem: 'script'},
            {block: 'ua'},
            {block: 'jquery'},
            {block: 'lightbox'},
            {block: 'img'},
            {block: 'img', mod: {name: 'lightbox', val: true}},
          ],
        }
      );
    });
  });
});

describe('bemdeps-loader', () => {
  it('should pass normal bemjson', () => {
    const paths = getCasePaths('normal-bemjson');

    return runWebpack(paths.source).then((result) => {
      expect(result).to.eql(require(paths.expected));
    });
  });

  it('should pass normal bemjson without stringify', () => {
    const paths = getCasePaths('normal-bemjson');

    return runWebpack(paths.source, false).then((result) => {
      expect(result).to.eql(require(paths.expected));
    });
  });

  it('should invalidate cache when .dep.js added', function(done) {
    this.timeout(30000); // eslint-disable-line no-invalid-this

    const paths = getCasePaths('bemjson-dep-add');

    const source = path.join(__dirname, 'levels', 'blocks.common',
      'add-dep', 'add-dep.deps.js');
    const changed = path.join(__dirname, 'levels', 'blocks.common',
      'add-dep', 'add-dep_changed.deps.js');

    fs.writeFileSync(source, fs.readFileSync(changed));
    fs.unlinkSync(source);

    let firstRun = false;
    let firstTimerId = null;
    const cb = (result) => {
      expect(typeof result).to.be.a('string');

      if (!firstRun) {
        if (firstTimerId) {
          clearTimeout(firstTimerId);
        }

        firstTimerId = setTimeout(() => {
          firstRun = true;
          fs.writeFileSync(source, fs.readFileSync(changed));
        }, 5000);
      } else {
        setTimeout(() => {
          expect(result).to.eql(require(paths.expected));
          done();
        }, 5000);
      }
    };

    watchWebpack(paths.source, true, cb);
  });

  it('should invalidate cache when .dep.js removed', function(done) {
    this.timeout(30000); // eslint-disable-line no-invalid-this

    const paths = getCasePaths('bemjson-dep-remove');

    const source = path.join(__dirname, 'levels', 'blocks.common',
      'remove-dep', 'remove-dep.deps.js');
    const original = path.join(__dirname, 'levels', 'blocks.common',
      'remove-dep', 'remove-dep_original.deps.js');

    fs.writeFileSync(source, fs.readFileSync(original));

    let firstRun = false;
    let firstTimerId = null;
    const cb = (result) => {
      expect(typeof result).to.be.a('string');

      if (!firstRun) {
        if (firstTimerId) {
          clearTimeout(firstTimerId);
        }

        firstTimerId = setTimeout(() => {
          firstRun = true;
          fs.unlinkSync(source);
        }, 5000);
      } else {
        setTimeout(() => {
          expect(result).to.eql(require(paths.expected));
          done();
        }, 5000);
      }
    };

    watchWebpack(paths.source, true, cb);
  });

  it('should invalidate cache when .dep.js changed', function(done) {
    this.timeout(30000); // eslint-disable-line no-invalid-this

    const paths = getCasePaths('bemjson-dep-change');

    const source = path.join(__dirname, 'levels', 'blocks.common',
      'change-dep', 'change-dep.deps.js');
    const original = path.join(__dirname, 'levels', 'blocks.common',
      'change-dep', 'change-dep_original.deps.js');
    const changed = path.join(__dirname, 'levels', 'blocks.common',
      'change-dep', 'change-dep_changed.deps.js');

    fs.writeFileSync(source, fs.readFileSync(original));

    let firstRun = false;
    let firstTimerId = null;
    const cb = (result) => {
      expect(typeof result).to.be.a('string');

      if (!firstRun) {
        if (firstTimerId) {
          clearTimeout(firstTimerId);
        }

        firstTimerId = setTimeout(() => {
          firstRun = true;
          fs.writeFileSync(source, fs.readFileSync(changed));
        }, 5000);
      } else {
        setTimeout(() => {
          expect(result).to.eql(require(paths.expected));
          done();
        }, 5000);
      }
    };

    watchWebpack(paths.source, true, cb);
  });

  it('should invalidate cache when block added', function(done) {
    this.timeout(30000); // eslint-disable-line no-invalid-this

    const paths = getCasePaths('bemjson-block-add');

    const source = path.join(__dirname, 'levels', 'blocks.common',
      'add-block');
    const changed = path.join(__dirname, 'levels', 'blocks.common',
      'add-block_original');

    fse.removeSync(source);

    let firstRun = false;
    let firstTimerId = null;
    const cb = (result) => {
      expect(typeof result).to.be.a('string');

      if (!firstRun) {
        if (firstTimerId) {
          clearTimeout(firstTimerId);
        }

        firstTimerId = setTimeout(() => {
          firstRun = true;
          fse.copySync(changed, source);
        }, 5000);
      } else {
        setTimeout(() => {
          expect(result).to.eql(require(paths.expected));
          done();
        }, 5000);
      }
    };

    watchWebpack(paths.source, true, cb);
  });

  it('should invalidate cache when block removed', function(done) {
    this.timeout(30000); // eslint-disable-line no-invalid-this

    const paths = getCasePaths('bemjson-block-remove');

    const source = path.join(__dirname, 'levels', 'blocks.common',
      'remove-block');
    const original = path.join(__dirname, 'levels', 'blocks.common',
      'remove-block_original');

    fse.copySync(original, source);

    let firstRun = false;
    let firstTimerId = null;
    const cb = (result) => {
      expect(typeof result).to.be.a('string');

      if (!firstRun) {
        if (firstTimerId) {
          clearTimeout(firstTimerId);
        }

        firstTimerId = setTimeout(() => {
          firstRun = true;
          fse.removeSync(source);
        }, 5000);
      } else {
        setTimeout(() => {
          expect(result).to.eql(require(paths.expected));
          done();
        }, 5000);
      }
    };

    watchWebpack(paths.source, true, cb);
  });
});

/**
 * Generate paths to source and expected files
 *
 * @param {String} caseName
 * @return {{source: *, expected: *}}
 */
function getCasePaths(caseName) {
  return {
    'source': path.join(__dirname, 'cases', caseName,
      'source.bemjson.js'),
    'expected': path.join(__dirname, 'cases', caseName,
      'expected.bemjson.json'),
  };
}
