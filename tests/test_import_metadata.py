"""Regressions for iCUE's strict XML metadata parsing, not browser HTML parsing."""
from pathlib import Path
import unittest
from xml.dom import minidom

ROOT = Path(__file__).resolve().parents[1]


class ImportMetadataTests(unittest.TestCase):
    def test_document_prefix_and_head_parse_and_expose_title(self):
        html = (ROOT / "widget" / "index.html").read_text(encoding="utf-8")
        # Include the actual prefix. Parsing an isolated <head> missed the original failure.
        metadata = html[:html.index("</head>") + len("</head>")] + "</html>"
        document = minidom.parseString(metadata)
        titles = document.getElementsByTagName("title")
        self.assertEqual(len(titles), 1)
        self.assertEqual(titles[0].firstChild.nodeValue, "tr('Atomic Binary Clock')")
        self.assertTrue(html.startswith("<!DOCTYPE html>"), "XML's DOCTYPE keyword is case-sensitive")


if __name__ == "__main__":
    unittest.main()
