import * as core from '@actions/core'
import {GoogleCloudStorageMutex} from './locks'

async function run(): Promise<void> {
  try {
    const mutex = new GoogleCloudStorageMutex(
      core.getInput('bucket'),
      core.getInput('filename'),
      {timeout: core.getInput('timeout')}
    )
    await mutex.acquire()
  } catch (error) {
    if (error instanceof Error) {
      core.error(error.message)
    } else {
      core.error(`Unknown error ${error}`)
    }
    core.setFailed('Failed to acquire lock')
  }
}

run()
