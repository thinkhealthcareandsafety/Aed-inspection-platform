import type { ReactNode } from 'react';

/**
 * Every string the public inspection flow shows, in English — the source of
 * truth. `hi.tsx` must provide the same shape (it is typed against this
 * file), so a string missing from the Hindi build is a type error, not an
 * English word slipped into a Hindi screen.
 *
 * Entries that vary with a number or a name are functions; the few whose
 * word order differs between languages around a styled fragment take and
 * return React nodes.
 */
export const en = {
  lang: 'en' as 'en' | 'hi',
  /** How this language names itself, for the switch. */
  selfName: 'English',
  switchTo: 'हिन्दी में देखें',
  locale: 'en-GB',

  common: {
    brand: 'AED SmartX Inspector',
    /** Footer line naming the company behind aedsmartx. */
    productOf: (company: ReactNode): ReactNode => <>A {company} product</>,
    close: 'Close',
  },

  steps: { details: 'Details', model: 'Model', inspect: 'Inspect' },

  contact: {
    eyebrow: 'AI-checked in real time',
    title: ['Is your AED', 'ready to save', 'a life?'],
    intro:
      'Photograph six things on your defibrillator. Our AI reads every label and tells you instantly whether the device would work in an emergency.',
    facts: [
      { label: 'Free', sub: 'No charge' },
      { label: '3 min', sub: 'Six photos' },
      { label: 'PDF report', sub: 'See a sample' },
    ],
    name: 'Full name',
    namePlaceholder: 'Jane Doe',
    email: 'Email address',
    emailPlaceholder: 'you@organisation.com',
    didYouMean: (fix: ReactNode): ReactNode => <>Did you mean {fix}?</>,
    phone: 'Mobile number',
    errors: {
      name: 'Enter your full name',
      email: 'Enter a valid email address',
      phone: 'Enter a valid mobile number for the selected country',
    },
    privacy: 'We use your details only to send this report. No marketing lists, no sharing.',
    submit: 'Start free inspection',
    photosPrivate: 'Your photos are never shared or published',
  },

  sample: {
    title: 'Sample report',
    intro: 'Emailed the moment you finish: the verdict, what to do next, and every check with its photo.',
    pageAlt: (n: number, total: number) => `Sample report, page ${n} of ${total}`,
    open: 'Open PDF',
    start: 'Start free inspection',
  },

  phone: {
    selectCountry: 'Select country',
    search: 'Search country or code…',
    noMatches: 'No matches',
    lengthHint: (country: string, min: number, max: number, sofar: number) =>
      `${country} numbers need ${min === max ? `${min} digits` : `${min}-${max} digits`} (${sofar} so far)`,
  },

  model: {
    title: ['Which AED are', 'you inspecting?'],
    intro: 'Your checks and example photos are matched to this exact model.',
    settingUp: 'Setting up your checklist…',
    notSure: 'Not sure? The model name is printed on the front of the unit and on the label at the back.',
    editDetails: 'Edit my details',
    enlarge: (name: string) => `See a larger photo of the ${name}`,
    thisIsMine: 'This is my AED',
    others: 'Compare with the others',
    hints: {
      'Philips FRx': 'Blue-grey, often kept in a red carry case',
      'Philips HS1': 'Deeper blue and upright, with a carry strap',
      'Zoll AED Plus': 'Bright green, handle moulded into the top',
      'Zoll AED 3': 'Lime green and upright, with a colour screen on the front',
      'Zoll Powerheart G3': 'Navy and yellow, with a clear lid over the pads',
      'Zoll Powerheart G5': 'Orange and upright, with a round Rescue Ready light by the handle',
    } as Record<string, string>,
  },

  unlisted: {
    title: 'My AED isn’t listed',
    subtitle: 'Tell us which one and we’ll help you inspect it.',
    brandLabel: 'Which brand is it?',
    other: 'Other',
    modelLabel: 'Model',
    modelOptional: '(if you know it)',
    modelPlaceholder: 'e.g. printed on the front of the unit',
    chooseBrand: 'Choose a brand',
    ask: (brand: string | null) => `Ask for help with my ${brand ?? 'AED'}`,
    sending: 'Sending…',
    contactOn: (phone: string) => `We’ll contact you on ${phone}. No obligation.`,
    thanks: (name?: string) => (name ? `Thanks, ${name}` : 'Thanks'),
    notCovered: (unit: string | null, phone?: string) =>
      `The app doesn’t cover the ${unit ?? 'AED you have'} yet. Our team will contact you${
        phone ? ` on ${phone}` : ''
      } to help you inspect it.`,
  },

  inspection: {
    doneCount: (done: ReactNode, total: number): ReactNode => (
      <>
        {done} of {total} done
      </>
    ),
    options: 'Inspection options',
    requiredDone: 'Required checks done',
    restoring: 'Picking up where you left off…',
    startFailed: 'Could not start inspection. Please try again.',
    finishFailed: 'Could not finish the inspection. Please try again.',
    offlineTitle: 'No signal.',
    offlineBody: 'Checks you’ve finished are saved. Move somewhere with signal before the next photo.',
    checklist: 'Checklist',
    optionalExtras: (n: number) => `Optional extras (${n})`,
    finish: 'Finish & email my report',
    finishing: ['Saving your inspection…', 'Building your PDF report…', 'Sending your report…'],
    ready: {
      allDone: (n: number) => `All ${n} checks done`,
      needAttention: (n: number) => (n === 1 ? '1 check needs attention' : `${n} checks need attention`),
      finishHint: 'Finish to get your PDF report by email.',
      fixable: 'Most faults take under a minute to put right. Fix it and retake the photo, and it can still pass.',
      expired: (kinds: Array<'pads' | 'battery'>) => {
        const names = kinds.map((k) => (k === 'pads' ? 'pads' : 'battery')).join(' and ');
        const verb = kinds.length > 1 || kinds[0] === 'pads' ? 'need' : 'needs';
        return `The expired ${names} ${verb} replacing — you can ask us for a quote when you finish.`;
      },
      retake: (title: string) => `Retake ${title.toLowerCase()}`,
      addOptional: (n: number) => `Add the ${n} optional checks too`,
    },
  },

  check: {
    position: (index: number, total: number) => `Check ${index} of ${total}`,
    optionalExtra: 'Optional extra',
    video: 'Video',
    tips: {
      fillFrame: 'Fill the frame',
      avoidGlare: 'Avoid glare',
      holdSteady: 'Hold steady',
      seconds: (n: number) => `${n}+ seconds`,
      lightInFrame: 'Indicator in frame',
    },
    takePhoto: 'Take the photo',
    recordVideo: 'Record the video',
    tryAgain: 'Try again',
    skip: 'Skip',
    dontHave: 'I don’t have this',
    retake: 'Retake',
    carryOn: 'Carry on',
    next: { check: 'Next check', extra: 'Next extra', finish: 'Review & finish' },
    onComputer: 'On a computer?',
    continueOnPhone: 'Continue on your phone',
    passed: 'Passed',
    needsAttention: 'Needs attention',
    yourPhoto: (title: string) => `Your photo: ${title}`,
    listen: 'Listen to the instructions',
    stopListening: 'Stop',
    faultGuidance: 'Fix it if you can, then retake. Or carry on — it will be flagged in your report.',
    expiredGuidance: {
      pads: "Expired pads can't be fixed on the spot. Carry on — you can ask us for a replacement quote when you finish.",
      battery:
        "An expired battery can't be fixed on the spot. Carry on — you can ask us for a replacement quote when you finish.",
    },
    uploadFailed: (video: boolean) =>
      `Could not upload this ${video ? 'video' : 'photo'} — check your connection and try again.`,
    busyRetrying: 'The AI service is busy — trying again…',
    row: {
      skipped: 'Skipped',
      uploadFailed: 'Didn’t upload — tap to try again',
      needsAttention: 'Needs attention',
      now: 'Now',
    },
  },

  analysis: {
    preparing: (video: boolean) => `Preparing your ${video ? 'video' : 'photo'}`,
    uploading: (video: boolean, percent: number) => `Uploading your ${video ? 'video' : 'photo'}… ${percent}%`,
    reading: {
      serial_number: 'Reading the serial number',
      pads_expiry: 'Reading the pads expiry date',
      battery_expiry: 'Reading the battery date',
      battery_attached: 'Checking the battery is seated',
      pads_connected: 'Checking the pads are connected',
    } as Record<string, string>,
    looking: 'Looking at your photo',
    comparing: 'Checking it against the checklist',
    videoFrames: 'Pulling frames from the clip',
    videoWatching: 'Watching the status indicator',
    videoConfirming: 'Confirming the result',
    slow: 'Taking a little longer than usual — hang on',
    videoNote: 'Video usually takes about 15 seconds. Keep this screen open.',
    captureAlt: 'Your capture, being analysed',
  },

  /**
   * Each check's name and instruction. `byModel` replaces the instruction
   * for a unit where the generic one would be wrong — a ZOLL has no "big
   * green button", and an HS1's pads connect by cartridge, not by plug.
   * Matches the AI's device notes (python-cv device_profiles.py).
   */
  items: {
    serial_number: {
      title: 'Serial number',
      description: 'Photograph the label on the back of the AED so the serial number is sharp.',
      byModel: {
        'Philips FRx': 'Photograph the small “SN” label at the bottom of the back panel, close enough to read.',
        'Philips HS1': 'Photograph the small “SN” label at the bottom of the back panel, close enough to read.',
        'Zoll AED Plus': 'Photograph the barcode label on the back, just below the handle, close enough to read.',
        'Zoll AED 3': 'Photograph the serial number label on the back, just above the battery, close enough to read.',
        'Zoll Powerheart G3':
          'Turn the AED over and photograph the serial number label on the underside, close enough to read.',
        'Zoll Powerheart G5':
          'Photograph the “SN” serial number on the label on the back of the AED, close enough to read.',
      },
    },
    pads_expiry: {
      title: 'Pads expiry',
      description: 'Photograph the expiry date printed on the pads package.',
      byModel: {
        'Philips FRx': 'Photograph the expiry date on the grey SMART Pads II case — the small label near the bottom.',
        'Philips HS1': 'Photograph the expiry date on the pads cartridge, just below the body diagram.',
        'Zoll AED Plus': 'Photograph the expiry date on the pads pack or its box, beside the ⌛ symbol.',
        'Zoll AED 3': 'Photograph the pads package in the back of the AED, showing the date beside the ⌛.',
        'Zoll Powerheart G3': 'Photograph the pads’ expiry date through the clear lid — no need to open it.',
        'Zoll Powerheart G5':
          'Photograph the small expiry window on the front of the lid, close enough to read the date.',
      },
    },
    battery_expiry: {
      title: 'Battery expiry',
      description: 'Photograph the date on the battery label.',
      byModel: {
        'Philips FRx': 'Photograph the label on the blue battery at the back, showing the “Install before” date.',
        'Philips HS1': 'Photograph the label on the blue battery at the back, showing the install-before date.',
        'Zoll AED Plus':
          'Photograph the “Replace batteries on or before” label, just below the status window on the handle.',
        'Zoll AED 3': 'Photograph the white label on the battery at the back, showing the install-by date.',
        'Zoll Powerheart G3':
          'Lift the battery out of the bottom of the AED and photograph its label: it shows the date the battery was made. Then press it back in until it clicks.',
        'Zoll Powerheart G5':
          'Lift the battery out of the bottom of the AED and photograph its label: it shows the date the battery was made. Then press it back in until it clicks.',
      },
    },
    battery_attached: {
      title: 'Battery attached',
      description: 'Photograph the battery in place, showing it is pushed fully home.',
      byModel: {
        'Philips FRx': 'Photograph the back of the AED, showing the blue battery pushed fully in and flush.',
        'Philips HS1': 'Photograph the back of the AED, showing the blue battery pushed fully in and flush.',
        'Zoll AED Plus':
          'Photograph the battery compartment on the back: the cover closed and latched, or all ten cells seated.',
        'Zoll AED 3': 'Photograph the back of the AED, showing the battery clicked in flush with the case.',
        'Zoll Powerheart G3': 'Turn the AED over and photograph the battery in the bottom, pushed fully in and flush.',
        'Zoll Powerheart G5': 'Turn the AED over and photograph the battery in the bottom, pushed fully in and flush.',
      },
    },
    pads_connected: {
      title: 'Pads connected',
      description: 'Photograph the pads connector plugged into the AED.',
      byModel: {
        'Philips FRx': 'Photograph the blue pads plug pushed fully into the AED’s pads socket.',
        'Philips HS1': 'Photograph the front of the AED: the pads cartridge fitted, green PULL handle down.',
        'Zoll AED Plus': 'Lift the cover and photograph the pads cable plugged into its socket.',
        'Zoll AED 3': 'Photograph the pads cable plugged into its socket at the top right of the front.',
        'Zoll Powerheart G3':
          'Open the lid and photograph the pads connector plugged into its socket. The AED switches on and talks — that’s normal. Close the lid after.',
        'Zoll Powerheart G5':
          'Open the lid and photograph the pads connector plugged into its socket. The AED switches on and talks — that’s normal. Close the lid after.',
      },
    },
    readiness_indicator: {
      title: 'Readiness indicator',
      description: 'Film the AED’s ready indicator for at least 10 seconds, holding steady.',
      byModel: {
        'Philips FRx':
          'Film the small green Ready light (not the green On/Off button) for at least 10 seconds. It blinks every few seconds, so hold steady.',
        'Philips HS1':
          'Film the small green Ready light at the top right (not the green On/Off button) for at least 10 seconds. It blinks every few seconds.',
        'Zoll AED Plus':
          'Film the status window on the left of the handle for about 5 seconds, close enough to see the green ✓ or red ✗.',
        'Zoll AED 3':
          'Film the small status window just right of the On/Off button for about 5 seconds, close enough to see the green ✓.',
        'Zoll Powerheart G3':
          'With the lid closed, film the round Rescue Ready light beside the handle for about 10 seconds. Green means ready; red needs attention.',
        'Zoll Powerheart G5':
          'With the lid closed, film the round Rescue Ready light beside the handle for about 10 seconds. Green means ready; red needs attention.',
      },
    },
    child_key_pad: {
      title: 'Child key / child pads',
      description: 'Photograph the child key or child pads, if this AED has them.',
      byModel: {
        'Philips FRx': 'Photograph the infant/child key — kept beside the AED, not left in its slot.',
        'Philips HS1': 'Photograph the spare infant/child pads cartridge (teddy-bear icon), if you have one.',
        'Zoll AED Plus': 'Photograph the spare Pedi-padz II child pads pack, if you have one.',
        'Zoll AED 3':
          'Photograph the label on the pads package (CPR Uni-padz cover children too), or a spare Pedi-padz II pack.',
        'Zoll Powerheart G3': 'Photograph the spare child (pediatric) pads pack, if you have one.',
        'Zoll Powerheart G5':
          'Photograph the spare child (paediatric) pads pack — kept beside the AED, not plugged in.',
      },
    },
    aed_cabinet: { title: 'AED cabinet', description: 'Photograph the cabinet or case the AED is kept in.' },
    first_response_kit: {
      title: 'Fast response kit',
      description: 'Photograph the rescue kit: gloves, razor, scissors and mask.',
    },
    emergency_contacts: {
      title: 'Emergency contacts sticker',
      description: 'Photograph the emergency contact sticker on the AED or its cabinet.',
    },
  } as Record<string, { title: string; description: string; byModel?: Record<string, string> }>,

  reading: {
    serial: 'Serial number',
    expiry: 'Expiry date',
    replaceBy: 'Replace by',
    statusLight: 'Status light',
    status: { ready: 'Ready', fault: 'Fault', unclear: 'Unclear' } as Record<string, string>,
  },

  expiry: {
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    expiredDaysAgo: (n: number) => (n === 1 ? 'Expired yesterday' : `Expired ${n} days ago`),
    expiredMonthsAgo: (n: number) => `Expired ${n} months ago`,
    expiredYearsAgo: (n: number) => `Expired ${n}+ years ago`,
    today: 'Expires today',
    daysLeft: (n: number) => (n === 1 ? '1 day left' : `${n} days left`),
    monthsLeft: (n: number) => `${n} months left`,
    yearsLeft: (n: number) => `${n}+ years left`,
  },

  reference: {
    example: 'Example',
    correct: 'Correct',
    wrong: 'Wrong',
    illustration: 'Illustration',
    closeUp: 'Close-up',
    exampleN: (n: number) => `Example ${n}`,
    enlarge: (caption: string) => `Enlarge example: ${caption}`,
    whatToLookFor: 'What to look for',
    whatAFaultLooksLike: 'What a fault looks like',
    examples: 'Examples',
  },

  menu: {
    title: 'Inspection options',
    description: 'Switch to another AED model, continue on your phone, or start over.',
    phoneTitle: 'Continue on your phone',
    phoneDetail: 'Scan a code to carry on with your phone’s camera. Nothing is lost.',
    switchTitle: 'Switch AED model',
    switchDetail: (lost: number, model: string) =>
      `Picked the wrong one? Start on another model with your details filled in.${
        lost > 0 ? ` The ${lost === 1 ? 'check' : `${lost} checks`} done on this ${model} won’t be kept.` : ''
      }`,
    startOverTitle: 'Start over',
    startOverDetail: 'Clear your details and begin again.',
    language: 'Language',
    keepInspecting: 'Keep inspecting',
    backToOptions: 'Back to options',
    phoneIntro: 'Point your phone’s camera at the code. This inspection opens where you left off, with the camera ready.',
    qrAlt: 'QR code that opens this inspection on a phone',
    qrFailed: 'Couldn’t draw the code. Use the link below.',
    done: 'Done',
  },

  /** How old the AED is, from its serial label, against Think Health's
   *  5-year replacement cycle. */
  age: {
    shows: {
      serial: (year: number) => `This AED’s serial number shows it was made in ${year}.`,
      label: (year: number) => `This AED’s label shows it was made in ${year}.`,
    },
    title: {
      current: (year: number) => `Made in ${year} · under warranty`,
      checkInvoice: (year: number) => `Made in ${year} · check your warranty`,
      replace: (year: number, age: number) => `Made in ${year} · about ${age} years old`,
      replaceUrgently: (year: number) => `Made in ${year} · over 10 years old`,
    },
    body: {
      current: (shows: string) => `${shows} Its warranty is still valid. You can carry on with the inspection.`,
      checkInvoice: (shows: string) =>
        `${shows} Its warranty may still be valid, depending on the month you bought it — please check your invoice. You can carry on with the inspection.`,
      replace: (shows: string, age: number) =>
        `${shows} That makes it about ${age} years old, so its warranty has expired under our 5-year replacement policy. We recommend replacing it, as it may not meet the latest AHA guidelines. An AED usually lasts about 10 years when well maintained, so you can carry on with the inspection.`,
      replaceUrgently: (shows: string, age: number) =>
        `${shows} That makes it about ${age} years old — past the 10 years an AED usually lasts — and its warranty has expired under our 5-year replacement policy. We highly recommend replacing it, as it may not meet the latest AHA guidelines. You can still carry on with the inspection.`,
    },
  },

  score: {
    aria: (score: number, max: number) => `Readiness score ${score} out of ${max}`,
    label: 'Readiness score',
    earned: (marks: number) => `+${marks}`,
    needed: (n: number) => `${n} needed to pass`,
    failsTitle: 'Fails readiness',
    below: (model: string, n: number) => `Your ${model} scored below ${n}: it fails readiness.`,
  },

  result: {
    verdict: {
      PASS: { eyebrow: 'Inspection passed', title: 'Ready to save a life' },
      FAIL: { eyebrow: 'Inspection failed', title: 'Not rescue-ready yet' },
      REVIEW: { eyebrow: 'Needs review', title: 'Needs a closer look' },
      INCOMPLETE: { eyebrow: 'Incomplete', title: 'Inspection incomplete' },
    },
    subtitle: {
      PASS: (model: string, n: number) => `Your ${model} passed all ${n} required checks.`,
      FAIL: (model: string, failed: number, n: number) => `${failed} of ${n} checks found a problem on your ${model}.`,
      REVIEW: (model: string) => `Some checks on your ${model} couldn't be confirmed from the photos.`,
      INCOMPLETE: 'Not every required check was completed.',
    },
    emailed: (email: string) => `Report emailed to ${email}`,
    emailFailed: 'Email didn’t send — download your report',
    reportId: (id: string, when?: string) => `Report ${id}${when ? ` · ${when}` : ''}`,
    share: 'Share report',
    shareText: (model: string, verdict: string) => `${model}: ${verdict.toLowerCase()}.`,
    shareTitle: 'AED inspection report',
    download: 'Download PDF',
    preparing: 'Preparing…',
    replace: {
      both: 'Replace the pads and battery',
      pads: 'Replace the pads',
      battery: 'Replace the battery',
      whyExpired: "Expired pads and batteries can fail when they're needed most.",
      whySoon: 'Order ahead so this AED is never left without them.',
      supply: (model: string) => `We supply replacements for the ${model}.`,
      kind: { pads: 'Pads', battery: 'Battery' },
      cta: 'Get a replacement quote',
      sending: 'Sending your request…',
      contactOn: (phone?: string) => `${phone ? `We'll contact you on ${phone}. ` : ''}No obligation.`,
    },
    requested: {
      title: 'Quote requested',
      body: (phone?: string) => (phone ? `We'll be in touch on ${phone}.` : "We'll be in touch shortly."),
    },
    whatWeChecked: 'What we checked',
    status: { pass: 'Passed', fail: 'Failed', skipped: 'Skipped', error: 'Not done', pending: 'Not done' } as Record<
      string,
      string
    >,
    spares: {
      title: 'Need spares or accessories?',
      body: (model: string) => `Pads, batteries, cabinets and rescue kits for your ${model}.`,
      cta: 'Get a quote',
    },
    another: 'Inspect another AED',
    detailsKept: 'Your details are already filled in.',
    startOver: (name?: string) => (name ? `Not ${name}? Start over` : 'Start over with new details'),
  },

  errors: {
    busy: 'The AI service is busy right now. Please try again in a moment.',
    unreachable: 'Could not reach the AI analysis service. Please try again.',
    needsVideo: 'This check needs a short video, not a photo.',
    needsPhoto: 'This check needs a photo, not a video.',
    unsupportedMedia: 'Please upload a photo or a video.',
    inspectionComplete:
      'This inspection has been completed and its report issued, so it can no longer be changed. Start a new inspection instead.',
    notFound: 'This inspection could not be found.',
    tooMany: 'Too many requests. Please wait a moment and try again.',
    tooManyAttempts: 'This check has been retaken too many times. Please contact us if you need help.',
    network: 'Couldn’t connect. Check your signal and try again.',
    timeout: 'That took too long. Please try again.',
    unreadable: 'The AI couldn’t check this photo. Please try a clearer capture.',
    generic: 'Something went wrong. Please try again.',
  },
};

export type Messages = typeof en;
