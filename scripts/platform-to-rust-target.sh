#!/bin/sh

case "${TARGETPLATFORM}" in
    linux/amd64)
        echo "x86_64-unknown-linux-gnu"
        ;;
    linux/arm64/v8)
        echo "aarch64-unknown-linux-gnu"
        ;;
    linux/arm/v7)
        echo "armv7-unknown-linux-gnueabihf"
        ;;
    linux/arm)
        echo "arm-unknown-linux-gnuebihf"
        ;;
    *)
        echo "${TARGETPLATFORM}"
        exit 1
        ;;
esac
