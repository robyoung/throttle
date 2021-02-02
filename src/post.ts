import * as core from '@actions/core'
import {GoogleCloudStorageMutex} from './locks'

async function run(): Promise<void> {
  try {
    const mutex = new GoogleCloudStorageMutex(
      core.getInput('bucket'),
      core.getInput('filename'),
      {timeout: core.getInput('timeout')}
    )
    await mutex.release()
  } catch (error) {
    core.error(error.message)
    core.setFailed('Failed to release lock')
  }
}

run()
