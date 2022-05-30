# Salesforce React integration

## About

This project is a node app that acts as an integration between a Salesforce Org and Amazon S3.

The project is complementary with this integration that [exports Salesforce documents to Amazon S3](https://github.com/pozil/sf-docs-to-s3).

The goal of the integration is to allow Salesforce users to download Amazon S3 documents. The integration leverages OAuth 2.0 to authenticate users and performs security checks on document access.

## Installation

### Create a Salesforce Connected App

1. Log in to your Salesforce org.
1. At the top right of the page, select the gear icon and then click **Setup**.
1. From Setup, enter `App Manager` in the Quick Find and select **App Manager**.
1. Click **New Connected App**.
1. Enter `Amazon S3 Middleware` as the **Connected App Name**
1. Enter your **Contact Email**.
1. Under **API (Enable OAuth Settings)**, check the **Enable OAuth Settings** checkbox.
1. Enter `https://YOUR_HOST/auth/callback` as the **Callback URL** where `YOUR_HOST` is the host of this node app.
1. Under **Selected OAuth Scope**, move **Access and manage your data (API)** to the Selected OAuth Scopes list.
1. Click **Save**.
1. From this screen, copy the connected app’s **Consumer Key** and **Consumer Secret** some place temporarily.

### Deploy and Configure the Node App

1. Declare the following environment variables:

    | Variable Name           | Description                                                                                                                                                                                                    | Example                           |
    | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
    | `SF_LOGIN_URL`          | Salesforce login URL. Either:<br/>- `https://login.salesforce.com` for production and Developer Edition orgs<br/>- `https://login.salesforce.com` for sandboxes and scratch orgs<br/>- your own custom domain. | `https://login.salesforce.com`    |
    | `SF_AUTH_CALLBACK_URL`  | Connected app callback URL where `YOUR_HOST` in the example is the host that hosts this app. This value must match what's configured in the Connected App.                                                     | `https://YOUR_HOST/auth/callback` |
    | `SF_CONSUMER_KEY`       | Connected app consumer key.                                                                                                                                                                                    | _secret_                          |
    | `SF_CONSUMER_SECRET`    | Connected app consumer secret.                                                                                                                                                                                 | _secret_                          |
    | `SF_API_VERSION`        | Salesforce API version.                                                                                                                                                                                        | `54.0`                            |
    | `AWS_ACCESS_KEY_ID`     | Access key ID for your AWS IAM user.                                                                                                                                                                           | _secret_                          |
    | `AWS_SECRET_ACCESS_KEY` | Secret access key for your AWS IAM user.                                                                                                                                                                       | _secret_                          |
    | `AWS_REGION`            | Region of your S3 bucket.                                                                                                                                                                                      | `eu-west-3`                       |
    | `AWS_S3_BUCKET`         | Name of your S3 bucket.                                                                                                                                                                                        | `poz-sf-demo`                     |
    | `SESSION_SECRET`        | Secret key for signing the session cookie with a length of 32 characters or more.                                                                                                                              | _secret_                          |
    | `SESSION_DURATION`      | Salesforce session duration in minutes (default is 120 minutes).                                                                                                                                               | `120`                             |

    If you are testing locally, you can create a `.env` file at the root of the project with this template:

    ```properties
    SF_LOGIN_URL=https://login.salesforce.com
    SF_AUTH_CALLBACK_URL=https://YOUR_HOST/auth/callback
    SF_CONSUMER_KEY=
    SF_CONSUMER_SECRET=
    SF_API_VERSION=54.0

    AWS_ACCESS_KEY_ID=
    AWS_SECRET_ACCESS_KEY=
    AWS_REGION=
    AWS_S3_BUCKET=

    SESSION_SECRET=
    SESSION_DURATION=120
    ```

1. Run `npm start` to start the app.
