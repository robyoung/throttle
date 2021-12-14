import * as core from '@actions/core'
import * as github from '@actions/github'
import {Bucket, File, Storage} from '@google-cloud/storage'
import {ApiError} from '@google-cloud/common/build/src/util'

interface Lock {
  acquire(): Promise<void>
  release(): Promise<void>
}

export interface MutexOptions {
  timeout?: number | string
  identifier?: string
}

const TIME_PERIOD_PATTERN = /^(?:(\d+)m)?(?:(\d+)s)?$/

class TimePeriodError extends Error {
  name = 'TimePeriodError'
}

/**
 * Parse a number of microseconds from a time string.
 *
 */
function parseTimePeriod(period: string): number {
  const match = period.match(TIME_PERIOD_PATTERN)
  if (match === null) {
    throw new TimePeriodError(`Invalid time period string: ${period}`)
  } else {
    const minutes = match[1] || 0
    const seconds = match[2] || 0
    return Number(minutes) * 60 + Number(seconds)
  }
}

/**
 * Generate a default identifier this mutex
 *
 * The identifier is used to verify that this invocation is the owner of the
 * mutex before releasing it.
 */
function defaultMutexIdentifier(): string {
  const context = github.context
  return `${context.repo.owner}/${context.repo.repo}/${context.workflow}/${context.runNumber}/${context.job}`
}

const INITIAL_SLEEP = 500

export class GoogleCloudStorageMutex implements Lock {
  file: File
  timeout: number
  identifier: string

  constructor(bucket: string, name: string, options: MutexOptions = {}) {
    this.file = new File(new Bucket(new Storage(), bucket), name, {
      generation: 0
    })

    if (options.timeout === null || options.timeout === undefined) {
      this.timeout = 5 * 60 * 1000 // 5 minutes
    } else if (typeof options.timeout === 'string') {
      this.timeout = parseTimePeriod(options.timeout) * 1000
    } else {
      this.timeout = options.timeout
    }

    if (options.identifier === null || options.identifier === undefined) {
      this.identifier = defaultMutexIdentifier()
    } else {
      this.identifier = options.identifier
    }
  }

  async acquire(): Promise<void> {
    const start = Date.now()
    let sleep = INITIAL_SLEEP

    for (;;) {
      try {
        await this.file.save(this.identifier, {resumable: false})
        core.info('Acquired lock')
        return
      } catch (e) {
        if (e instanceof ApiError && e.code === 412) {
          const delta = Date.now() - start
          if (delta < this.timeout) {
            core.info(`Cannot acquire lock, sleeping for ${sleep / 1000.0}s`)
            await new Promise(resolve => setTimeout(resolve, sleep))
            sleep = sleep * 2
            continue
          }
        }
        core.info('Cannot acquire lock, raising')
        throw e
      }
    }
  }

  async release(): Promise<void> {
    try {
      const data = await this.file.download()
      if (data[0].toString() === this.identifier) {
        await this.file.delete()
      } else {
        core.info(`Locked by someone else (${data[0]} !== ${this.identifier})`)
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === 404) {
        // no lock to release
      } else {
        throw e
      }
    }
  }
}
