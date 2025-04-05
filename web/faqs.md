---
layout: default
permalink: /faqs.html
title: FAQs - Frequently Asked Questions
---

# FAQs

## **Q: Why are the returned audio files always WAV 44100 Hz 16-bit?**

**Answers:**
* **.wav format**: it is a simple way to directly return the output of the AI model without compression. Adding support for other audio formats would over-complicate our website and not improve the quality
* **44100 Hz sample rate:** it is the only one supported by the AI model, and input audio is converted to 44100 Hz before processing. Audio is returned as-is after processing since resampling will not improve the quality
* **16-bit depth:** it keeps the wav files smaller and reduces memory usage of our website. However, we have added a new feature in **"Advanced settings"** that allows you to select **32-bit output.** [Try it out and see!](/#demixer-app).

For other questions not covered by this FAQ, contact us via [e-mail](mailto:contact@freemusicdemixer.com) or through our [Instagram account](https://www.instagram.com/musicdemixer/)
