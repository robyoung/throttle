# Throttle

[![build-test](https://github.com/robyoung/throttle/actions/workflows/test.yml/badge.svg)](https://github.com/robyoung/throttle/actions/workflows/test.yml)

A GitHub action for serializing jobs across workflow runs and more with Google Cloud Storage.

If you just need to serialize workflow runs within a single workflow you could also use [turnstyle](https://github.com/softprops/turnstyle).

Throttle uses a file in a Google Cloud Storage bucket as a mutex with which you can create
critical sections that can only have one job running across many workflows. The idea is inspired
by [gcslock](https://github.com/mco-de/gcslock).

## Contents

- [Usage](#usage)
- [Inputs](#inputs)

## Usage

Throttle depends on the GCP credentials being available. In this example they are set by the
[google-github-actions/setup-gcloud](https://github.com/google-github-actions/setup-gcloud) action.

```yaml
- name: Set up Cloud SDK
  uses: google-github-actions/setup-gcloud@master
  with:
    service_account_key: ${{ secrets.GCP_KEY }}
    export_default_credentials: true

- name: Start critical section
  uses: robyoung/throttle@v1
  with:
    bucket: throttle-test
    filename: test

- name: Do some work
  run: echo "I'm in the critical section"
```

The mutex is automatically released at the end of the job.

Timing out can be handled with the `timeout` option or use the job level option [`timeout-minutes`](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions#jobsjob_idtimeout-minutes).

## Inputs

| Name       | Required | Default | Description |
| ---------- | -------- | ------- | ----------- |
| `bucket`   | _required_ |         | The Google Cloud Storage bucket name to use. |
| `filename` | _optional_ | `lock`  | The name of the file to use as a lock. |
| `timeout`  | _optional_ | `10m`   | The timeout before acquiring the lock should fail in the format 10m for 10 minutes or 10s for 10 seconds. |

### Environment variables

| Name | Description |
| ---- | ----------- |
| `GOOGLE_APPLICATION_CREDENTIALS` | The [Google Application Credentials](https://cloud.google.com/docs/authentication/production) that should be used to create the lock file. |
