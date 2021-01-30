import React, { useContext, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { sendKill, launch, updateGame } from '../../helper'
import ContextProvider from '../../state/ContextProvider'
import { GameStatus } from '../../types'
const { ipcRenderer, remote } = window.require('electron')
const {
  dialog: { showMessageBox },
} = remote
interface Card {
  cover: string
  logo: string
  title: string
  appName: string
  isInstalled: boolean
}

interface InstallProgress {
  percent: string
  bytes: string
}

const GameCard = ({ cover, title, appName, isInstalled, logo }: Card) => {
  const [progress, setProgress] = useState({
    percent: '0.00%',
    bytes: '0/0MB',
  } as InstallProgress)

  const { libraryStatus, handleGameStatus } = useContext(ContextProvider)

  const gameStatus: GameStatus = libraryStatus.filter(
    (game) => game.appName === appName
  )[0]

  const { status } = gameStatus || {}
  const isInstalling = status === 'installing' || status === 'updating'
  const isReparing = status === 'repairing'
  const isMoving = status === 'moving'

  useEffect(() => {
    const progressInterval = setInterval(() => {
      if (isInstalling) {
        ipcRenderer.send('requestGameProgress', appName)
        ipcRenderer.on(
          `${appName}-progress`,
          (event: any, progress: InstallProgress) => setProgress(progress)
        )
      }
    }, 500)
    return () => clearInterval(progressInterval)
  }, [isInstalling, appName])

  const { percent } = progress
  const effectPercent = isInstalling
    ? `${150 - Number(percent.replace('%', ''))}%`
    : '100%'

  return (
    <>
      <div className="gameCard">
        {isInstalling && <span className="progress">{percent}</span>}
        {isMoving && <span className="progress">Moving...</span>}
        {isReparing && <span className="progress">Repairing...</span>}
        {logo && (
          <img
            alt="logo"
            src={logo}
            style={{
              filter: isInstalled ? 'none' : `grayscale(${effectPercent})`,
            }}
            className="gameLogo"
          />
        )}
        <Link
          to={{
            pathname: `/gameconfig/${appName}`,
          }}
          className="gameImg"
        >
          <img
            alt="cover-art"
            className="gameImg"
            src={cover}
            style={{
              filter: isInstalled ? 'none' : `grayscale(${effectPercent})`,
            }}
          />
          <div className="gameTitle">
            <span>{title}</span>
          </div>
        </Link>
        <i
          onClick={handlePlay()}
          className={`material-icons ${
            isInstalled ? 'is-success' : 'is-primary'
          }`}
        >
          {isInstalled ? 'play_circle' : 'get_app'}
        </i>
      </div>
    </>
  )

  function handlePlay() {
    return async () => {
      if (status === 'playing' || status === 'updating') {
        handleGameStatus({ appName, status: 'done' })
        return sendKill(appName)
      }

      console.log('play?', appName, status)
      handleGameStatus({ appName, status: 'playing' })
      await launch(appName).then(async (err: string | string[]) => {
        if (!err) {
          return
        }
        if (err.includes('ERROR: Game is out of date')) {
          const { response } = await showMessageBox({
            title: 'Game Needs Update',
            message: 'This game has an update, do you wish to update now?',
            buttons: ['YES', 'NO'],
          })

          if (response === 0) {
            handleGameStatus({ appName, status: 'updating' })
            await updateGame(appName)
            return handleGameStatus({ appName, status: 'done' })
          }
          handleGameStatus({ appName, status: 'playing' })
          await launch(`${appName} --skip-version-check`)
          return handleGameStatus({ appName, status: 'done' })
        }
      })

      return handleGameStatus({ appName, status: 'done' })
    }
  }
}

export default GameCard
