const shell = require('shelljs')

shell.echo('##########################')
shell.echo('#     Building vue       #')
shell.echo('##########################')

shell.cd('vue')
const PUBLIC = '../spring/src/main/resources/public/'
shell.rm('-rf', PUBLIC);
if (shell.exec('npm run build').code !== 0) {
  shell.echo('Error: vue build failed')
  shell.exit(1)
}
shell.cp('-R', 'dist/', PUBLIC)
shell.cd('..')

shell.echo('##########################')
shell.echo('#     Building spring    #')
shell.echo('##########################')

shell.cd('spring')
const gradle = process.platform === 'win32' ? 'gradlew' : './gradlew'
if (shell.exec(gradle + ' build').code !== 0) {
  shell.echo('Error: spring build failed')
  shell.exit(1)
}
