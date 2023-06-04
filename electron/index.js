const { app, ipcMain, BrowserWindow, dialog } = require('electron')
const path = require('path')
const url = require('url')
var findPort = require('find-free-port')
const isDev = require('electron-is-dev')
const logger = require('./logger')
const axios = require('axios')

const { autoUpdater } = require("electron-updater");

const JAR = 'spring-1.0.0.jar' // how to avoid manual update of this?
const MAX_CHECK_COUNT = 10

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

// The server url and process
let serverProcess
let baseUrl

function startServer(port) {
  logger.info(`Starting server at port ${port}`)

  const server = `${path.join(app.getAppPath(), '..', '..', JAR)}`
  logger.info(`Launching server with jar ${server} at port ${port}...`)

  serverProcess = require('child_process').spawn('java', [
    '-jar',
    server,
    `--server.port=${port}`,
  ])

  serverProcess.stdout.on('data', logger.server)

  if (serverProcess.pid) {
    if (process.platform !== 'darwin') {
      baseUrl = `http://localhost:${port}`;
    } else {
      baseUrl = `http://127.0.0.1:${port}`;
    }

    logger.info('Server PID: ' + serverProcess.pid)
  } else {
    logger.error('Failed to launch server process.')
  }
}

function stopServer() {
  logger.info('Stopping server...')
  axios
    .post(`${baseUrl}/actuator/shutdown`, null, {
      headers: { 'Content-Type': 'application/json' },
    })
    .then(() => logger.info('Server stopped'))
    .catch((error) => {
      logger.error('Failed to stop the server gracefully.', error)
      if (serverProcess) {
        logger.info(`Killing server process ${serverProcess.pid}`)
        const kill = require('tree-kill')
        kill(serverProcess.pid, 'SIGTERM', function (err) {
          logger.info('Server process killed')
          serverProcess = null
          baseUrl = null
          app.quit() // quit again
        })
      }
    })
    .finally(() => {
      serverProcess = null
      baseUrl = null
      app.quit() // quit again
    })
}

function createSplash() {
  const splash = new BrowserWindow({ width: 400, height: 300, frame: false })
  splash.loadURL(
    url.format({
      pathname: path.join(__dirname, 'splash.html'),
      protocol: 'file:',
      slashes: true,
    })
  )
  return splash
}

function createWindow(callback) {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false, // hide until ready-to-show
    webPreferences: {
      webSecurity: false, // CORS 해제를 위해 webSecurity 설정을 false로 변경
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  loadHomePage()

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (callback) callback()
  })

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
}

function quitOnError(title, content) {
  logger.error(content)
  dialog.showErrorBox(title, content)
  app.quit()
}

function loadHomePage() {
  logger.info(`Loading home page at ${baseUrl}`)
  // check server health and switch to main page
  checkCount = 0
  setTimeout(function cycle() {
    axios
      .get(`${baseUrl}/actuator/health`)
      .then(() => mainWindow.loadURL(`${baseUrl}?_=${Date.now()}`))
      .catch((e) => {
        if (e.code === 'ECONNREFUSED') {
          if (checkCount < MAX_CHECK_COUNT) {
            checkCount++
            setTimeout(cycle, 1000)
          } else {
            // dialog.showErrorBox("error", e.toString());

            quitOnError(
              'Server timeout',
              `UI does not receive server response for ${MAX_CHECK_COUNT} seconds.`
            )
            app.quit()
          }
        } else {
          logger.error(e)
          quitOnError('Server error', 'UI receives an error from server.')
        }
      })
  }, 200)
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  logger.info('###################################################')
  logger.info('#               Application Starting              #')
  logger.info('###################################################')

  // handle messages from ipcRenderer via preload.js
  ipcMain.on('app:badgeCount', (_, count) => app.setBadgeCount(count))
  ipcMain.handle('dialog:openFile', () => dialog.showOpenDialogSync())
  ipcMain.handle('dialog:saveFile', () => dialog.showSaveDialogSync())

  if (isDev) {
    // Assume the webpack dev server is up at port 9000
    baseUrl = `http://localhost:9000`
    createWindow()
  } else {
    // Create window first to show splash before starting server
    const splash = createSplash()

    // Start server at an available port (prefer 8080)
    findPort(8080, function (err, port) {
      if (!err) {
        startServer(port)
        createWindow(() => splash.close())
      } else {
        quitOnError('Error', 'Unable to get a server port.')
      }
    })
  }
})

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

app.on('will-quit', (e) => {
  if (!isDev && baseUrl != null) {
    stopServer()
    e.preventDefault() // will quite later after stopped the server
  }
})
// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
/* UPDATER */
autoUpdater.autoDownload = false;

autoUpdater.on("checking-for-update", () => {
  logger.info("업데이트 확인 중");
});

autoUpdater.on("update-available", info => {
  logger.info("업데이트 확인");

  // dialog
  //     .showMessageBox({
  //       type: "info",
  //       title: "Update",
  //       message:
  //           "새로운 버전이 등록되었습니다. 업데이트를 진행하시겠습니까?",
  //       buttons: ["지금 설치", "나중에 설치"]
  //     })
  //     .then(result => {
  //       const { response } = result;
  //
  //       // if (response === 0) autoUpdater.downloadUpdate();
  //       if (response === 0) {
  //         autoUpdater.downloadUpdate()
  //       };
  //     });
  autoUpdater.downloadUpdate()
});

autoUpdater.on("update-not-available", () => {
  //업데이트할 자료가 없으면 Application 실행
  runApplication();
});

function runApplication() {
  // 서버 시작 전 스플래시 화면 실행
  const splash = createSplash();

  //1. application.yml 생성
  jarProperties.createPropertyFile(appPath);

  findPort(8080, function(err, port) {
    if (!err) {
      //2. 서버 실행
      startServer(port);
      //3. 화면 실행
      createWindow(() => splash.close());
    } else {
      quitOnError('오류', '연계 모듈을 찾을 수 없습니다. 관리자에게 문의하세요.')
    }
  });
}

autoUpdater.once("download-progress", r => {
  //한번만 실행

  progressBar = new ProgressBar({
    indeterminate: false,
    title: '프로그램 업데이트',
    text: '업데이트를 진행 중 입니다.',
    detail: '잠시만 기다리세요.',
    maxValue: r.total,
  });

  progressBar
      .on("completed", () => {
        console.log("설치 완료");
      })
      .on("aborted", () => {
        console.log("aborted");
      });
});
autoUpdater.on("download-progress", r => {
  //업데이트 진행 상황 입력
  progressBar.value = r.transferred;

  let value = Math.round(progressBar.value / 1024).toLocaleString();
  let max = Math.round(progressBar.getOptions().maxValue / 1024).toLocaleString();
  let downSpeed = r.bytesPerSecond / 1024 / 1024;

  progressBar.detail = `${value} / ${max} (${downSpeed.toFixed(2)} MB/초)`;
});

autoUpdater.on("update-downloaded", () => {
  if (progressBar != null) {
    progressBar.setCompleted();

    // dialog
    //     .showMessageBox({
    //       type: "info",
    //       title: "Update",
    //       message: "새로운 버전이 다운로드 되었습니다. 다시 시작하시겠습니까?",
    //       buttons: ["예", "아니오"]
    //     })
    //     .then(result => {
    //       const { response } = result;
    //
    //       if (response === 0) autoUpdater.quitAndInstall(false, true);
    //     });
    autoUpdater.quitAndInstall(false, true);
  } else {
    dialog
        .showMessageBox({
          type: "info",
          title: "Update",
          message: "업데이트가 진행되지 않았습니다. 업데이트를 진행합니다.",
          buttons: ["진행"]
        })
        .then(result => {
          const { response } = result;

          if (response === 0) autoUpdater.quitAndInstall(false, true);
        });
  }
});
/* UPDATER */