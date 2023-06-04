const shell = require('shelljs')

shell.echo('##########################')
shell.echo('#    Building electron   #')
shell.echo('##########################')

if (!shell.test('-e', 'spring/build/libs')) {
  shell.echo('Error: server is not built yet.')
  shell.exit(1)
}

shell.rm('-rf', 'dist')
if (shell.exec('electron-builder build').code !== 0) {
  shell.echo('Error: electron build failed')
  shell.exit(1)
}
