#!/usr/bin/env python3
"""Decode synthetic SMTP messages using the installed standard-library MIME parser."""
import json
import re
import sys
from email import policy
from email.parser import BytesParser
from html.parser import HTMLParser


class HtmlLinks(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.text = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() == 'a':
            self.links.extend(value for name, value in attrs if name.lower() == 'href' and value)

    def handle_data(self, data):
        self.text.append(data)


def mailbox_record(raw):
    message = BytesParser(policy=policy.default).parsebytes(raw)
    plain = []
    html = []
    for part in message.walk():
        if part.is_multipart() or part.get_content_disposition() == 'attachment':
            continue
        if part.get_content_type() == 'text/plain':
            plain.append(part.get_content())
        elif part.get_content_type() == 'text/html':
            parsed = HtmlLinks()
            parsed.feed(part.get_content())
            html.extend(parsed.links + [' '.join(parsed.text)])
    # Preserve the mailbox API and let the unchanged canonical test validate the URL.
    for body in plain + html:
        match = re.search(r'https?://[^\s<>\"\']+', body)
        if match:
            return {'url': match[0]}
    return {}


if __name__ == '__main__':
    print(json.dumps(mailbox_record(sys.stdin.buffer.read())))
