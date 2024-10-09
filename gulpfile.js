const gulp = require('gulp');
const uglify = require('gulp-uglify');
const concat = require('gulp-concat');

// Task to minify all JS files
gulp.task('minify-js', function() {
  return gulp.src(['js/*.js'])
    .pipe(uglify())
    .pipe(gulp.dest('web/'));
});
