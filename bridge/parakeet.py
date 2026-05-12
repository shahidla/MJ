"""
Called by bridge/assemblyai.js — reads WAV path from argv, returns transcript to stdout.
Usage: python parakeet.py <wav_file_path>
"""
import sys
from gradio_client import Client, handle_file

if len(sys.argv) < 2:
    sys.exit(1)

wav_path = sys.argv[1]

try:
    client = Client("nvidia/parakeet-tdt-0.6b-v3", verbose=False)
    result = client.predict(
        audio_path=handle_file(wav_path),
        api_name="/transcribe_file"
    )

    # result is a tuple: (dataframe_dict, csv_update, srt_update)
    # dataframe_dict has keys: headers, data
    # data rows: [start, end, segment_text]
    if isinstance(result, tuple):
        table = result[0]
    else:
        table = result

    rows = table.get('data', [])
    segments = []
    for row in rows:
        if len(row) >= 3:
            segment = str(row[2]).strip()
            if segment and segment.lower() != 'error':
                segments.append(segment)

    if segments:
        print(' '.join(segments), flush=True)
    else:
        # check for error
        for row in rows:
            if len(row) >= 3 and str(row[2]).startswith('Transcription failed'):
                print(f"ERROR: {row[2]}", file=sys.stderr, flush=True)
                sys.exit(1)

except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr, flush=True)
    sys.exit(1)
