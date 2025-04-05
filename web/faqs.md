---
layout: default
permalink: /faqs.html
title: FAQs - Frequently Asked Questions
---

# FAQs

## **Q: How much memory do I pick?**

**Answer:**
From our settings, you can choose 4, 8, 16, or 32 GB of memory. These correspond to 1, 2, 4, and 8 threads. More threads means faster demixing. Choose the max that can fit in your device RAM/memory. Read <a href="/getting-started/2024/09/20/How-to-pick-max-memory" target="_blank" rel="noopener noreferrer" alt="memory-guide">our guide on how to pick max memory</a> for your computer.
Note that when demixing a large song, you **need to give the job more memory** or else risk crashing!

## **Q: Why are the returned audio files always WAV 44100 Hz 16-bit?**

**Answers:**
* **.wav format**: it is a simple way to directly return the output of the AI model without compression or affecting audio quality
* **44100 Hz sample rate:** it is the only one supported by the AI model, and input audio is converted to 44100 Hz before processing, which we return directly instead of resampling to the original sample rate
* **16-bit depth:** (16-bit PCM, pcm_s16le) keeps the wav files smaller and reduces memory usage of our website. However, we have added a new feature in **"Advanced settings"** to select **32-bit output** (32-bit float PCM, pcm_f32le). [Try it out and see!](/#demixer-app).

## **Q: How do I debug an error if the app fails or crashes?**

**Answer:**
1. **Check the developer console**: Open the developer console in your browser and look for any error messages in the console tab. Use [this guide](https://balsamiq.com/support/faqs/browser-console/) for instructions on different browsers and operating systems
2. **Check the network tab**: In the developer console, go to the network tab and look for any failed requests
3. Retry the demixing job with a different memory setting or a lower quality setting
4. If it still doesn't work, [email us](/support#customer-support)). Include the full copy-paste of the developer console output and the job settings (including audio file size and length and demixer settings)

For other questions not covered by this FAQ, contact us via [email](mailto:contact@freemusicdemixer.com) or through our [Instagram account](https://www.instagram.com/musicdemixer/)
