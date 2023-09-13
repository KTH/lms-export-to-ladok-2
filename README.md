# LMS Transfer to Ladok

## Copyright © 2019, [KTH](https://github.com/kth)

Sends results of an assignment in Canvas LMS as module in Ladok.

# Get started

1. install app

```
  $ npm install
```

2. create Ladok certificate
3. add reporter permissions to Ladok
4. set up .env
5. start app

```
  $ npm run start
```

# Certificate

This app needs a valid certificate from Ladok since it uploads grades to Ladok. When such a certificate has been downloaded, do the following to generate a base 64 encoded string from the certificate:

    openssl pkcs12 -export -out <pfxname>.pfx -inkey <keyname>@KTH.key -in <certname>@KTH.crt
    base64 -i <pfxname>.pfx

Example:

    openssl pkcs12 -export -out kth.emilsten.pfx -inkey emilsten@KTH.key -in emilsten@KTH.crt
    base64 -i kth.emilsten.pfx

_Then remove all of the newlines of the newly created base 64 string_ and add this string to the .env file in the `LADOK_API_PFX_BASE64` environment variable.

# Add reporter rights

After the app is configured to use the Ladok certificate, _the user has to be reporter in all of the subaccounts/schools in Ladok_. This is necessary to let the system user report grades in Ladok.
To do this, run the script [add-reporter](https://github.com/KTH/lms-scripts/tree/master/add-reporter).
