import {GoogleCloudStorageMutex} from '../src/locks'
import {ApiError} from '@google-cloud/common/build/src/util'

const BUCKET_NAME = 'throttle-test'
const FILE_NAME = 'example'

describe('GoogleCloudStorageMutex', () => {
  const DEFAULT_MUTEX_OPTIONS = {
    identifier: 'custom-identifier'
  }

  describe('initialization', () => {
    it('should set File', () => {
      let mutex = new GoogleCloudStorageMutex(
        BUCKET_NAME,
        FILE_NAME,
        DEFAULT_MUTEX_OPTIONS
      )

      expect(mutex.file.name).toStrictEqual(FILE_NAME)
    })

    describe('timeout', () => {
      it('should set a default', () => {
        let mutex = new GoogleCloudStorageMutex(
          BUCKET_NAME,
          FILE_NAME,
          DEFAULT_MUTEX_OPTIONS
        )

        expect(mutex.timeout).toEqual(300000)
      })

      function testTimeout(input: string | number, output: number): () => void {
        return function () {
          let mutex = new GoogleCloudStorageMutex(BUCKET_NAME, FILE_NAME, {
            ...DEFAULT_MUTEX_OPTIONS,
            timeout: input
          })

          expect(mutex.timeout).toEqual(output)
        }
      }

      it('should use a number timeout', testTimeout(100, 100))
      it('should parse a string timeout with minutes', testTimeout('1m', 60000))
      it('should parse a string timeout with seconds', testTimeout('1s', 1000))
      it(
        'should parse a string timeout with minutes and seconds',
        testTimeout('1m1s', 61000)
      )
      it('should fail to parse an invalid string timeout', () => {
        expect(() => {
          new GoogleCloudStorageMutex(BUCKET_NAME, FILE_NAME, {
            ...DEFAULT_MUTEX_OPTIONS,
            timeout: 'invalid'
          })
        }).toThrow()
      })
    })
  })

  describe('acquire', () => {
    let mutex: GoogleCloudStorageMutex

    beforeEach(() => {
      mutex = new GoogleCloudStorageMutex(
        BUCKET_NAME,
        FILE_NAME,
        DEFAULT_MUTEX_OPTIONS
      )
    })

    afterEach(() => {
      jest.resetAllMocks()
    })

    it('should return on success', async () => {
      let mockSave = jest
        .spyOn(mutex.file, 'save')
        .mockImplementation(async () => {})

      await mutex.acquire()

      expect(mockSave.mock.calls.length).toEqual(1)
      expect(mockSave.mock.calls[0][0]).toEqual(
        DEFAULT_MUTEX_OPTIONS.identifier
      )
    })

    it('should retry on failure', async () => {
      let error = new ApiError('')
      error.code = 412
      let mockSave = jest
        .spyOn(mutex.file, 'save')
        .mockImplementationOnce(async () => {
          throw error
        })
        .mockImplementationOnce(async () => {})

      await mutex.acquire()

      expect(mockSave.mock.calls.length).toEqual(2)
    })
  })

  describe('release', () => {
    let mutex: GoogleCloudStorageMutex
    let mockDelete: any

    beforeEach(() => {
      mutex = new GoogleCloudStorageMutex(
        BUCKET_NAME,
        FILE_NAME,
        DEFAULT_MUTEX_OPTIONS
      )
      mockDelete = jest
        .spyOn(mutex.file, 'delete')
        .mockImplementation(async () => {
          return true
        })
    })

    afterEach(() => {
      jest.resetAllMocks()
    })

    it('should delete the file if identifiers match', async () => {
      let mockDownload = jest
        .spyOn(mutex.file, 'download')
        .mockImplementation(async () => {
          return [Buffer.from(DEFAULT_MUTEX_OPTIONS.identifier)]
        })

      await mutex.release()

      expect(mockDownload.mock.calls.length).toEqual(1)
      expect(mockDelete.mock.calls.length).toEqual(1)
    })

    it('should not delete the file if identifiers do not match', async () => {
      let mockDownload = jest
        .spyOn(mutex.file, 'download')
        .mockImplementation(async () => {
          return [Buffer.from('other-identifier')]
        })

      await mutex.release()

      expect(mockDownload.mock.calls.length).toEqual(1)
      expect(mockDelete.mock.calls.length).toEqual(0)
    })

    it('should not delete the file if it is not found', async () => {
      let error = new ApiError('')
      error.code = 404
      let mockDownload = jest
        .spyOn(mutex.file, 'download')
        .mockImplementation(async () => {
          throw error
        })

      await mutex.release()

      expect(mockDownload.mock.calls.length).toEqual(1)
      expect(mockDelete.mock.calls.length).toEqual(0)
    })
  })
})
