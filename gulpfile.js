const gulp = require('gulp');
const uglify = require('gulp-uglify');
const { spawn } = require('child_process');
const path = require('path');

// Task to minify all JS files
gulp.task('minify-js', function() {
  return gulp.src(['js/*.js'])
    .pipe(uglify())
    .pipe(gulp.dest('web/'));
});

// Task to watch JS files and run minify-js on changes
gulp.task('watch-js', function() {
  gulp.watch('js/*.js', gulp.series('minify-js'));
});

// Task to run Jekyll serve
gulp.task('jekyll-serve', function(cb) {
  const jekyll = spawn('bundle', ['exec', 'jekyll', 'serve', '--livereload'], {
    cwd: path.join(__dirname, 'web'),
    stdio: 'inherit',
    shell: true
  });

  jekyll.on('close', function(code) {
    if (code !== 0) {
      console.error(`Jekyll process exited with code ${code}`);
    }
    cb(code);
  });
});

// Task to run Wrangler dev
gulp.task('wrangler-dev', function(cb) {
  const wrangler = spawn('npx', ['wrangler', 'pages', 'dev'], {
    cwd: path.join(__dirname, 'web'),
    stdio: 'inherit',
    shell: true
  });

  wrangler.on('close', function(code) {
    if (code !== 0) {
      console.error(`Wrangler process exited with code ${code}`);
    }
    cb(code);
  });
});

// Default task to run all tasks in parallel
gulp.task('default', gulp.parallel('watch-js', 'jekyll-serve', 'wrangler-dev'));
