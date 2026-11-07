package main

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func TestAuthenticatedArchive(t *testing.T) {
	key := bytes.Repeat([]byte{7}, 32)
	for _, plain := range [][]byte{{}, []byte("synthetic database dump"), bytes.Repeat([]byte("synthetic"), 20000)} {
		sealed, err := transform("encrypt", key, plain)
		if err != nil {
			t.Fatal(err)
		}
		got, err := transform("decrypt", key, sealed)
		if err != nil || !bytes.Equal(got, plain) {
			t.Fatal("round trip failed")
		}
		for _, bad := range [][]byte{sealed[:len(sealed)-1], append(append([]byte{}, sealed...), 0), append([]byte{}, sealed...)} {
			bad[len(bad)-1] ^= 1
			if _, err = transform("decrypt", key, bad); err == nil {
				t.Fatal("tampered archive accepted")
			}
		}
		wrong := bytes.Repeat([]byte{8}, 32)
		if _, err = transform("decrypt", wrong, sealed); err == nil {
			t.Fatal("wrong key accepted")
		}
	}
}
func TestAtomicOutputsAndKeys(t *testing.T) {
	dir := t.TempDir()
	key := filepath.Join(dir, "key")
	if err := run([]string{"keygen", "-out", key}, bytes.NewReader(nil)); err != nil {
		t.Fatal(err)
	}
	if err := run([]string{"keygen", "-out", key}, bytes.NewReader(nil)); err == nil {
		t.Fatal("existing key overwritten")
	}
	info, err := os.Stat(key)
	if err != nil || info.Mode().Perm() != 0600 {
		t.Fatal("unsafe key permissions")
	}
	out := filepath.Join(dir, "dump")
	if err := run([]string{"decrypt", "-key-file", key, "-out", out}, bytes.NewReader([]byte("invalid archive"))); err == nil {
		t.Fatal("invalid archive accepted")
	}
	if _, err = os.Stat(out); !os.IsNotExist(err) {
		t.Fatal("unauthenticated plaintext written")
	}
}

func TestVerifyNeverWritesPlaintext(t *testing.T) {
	dir := t.TempDir()
	keyPath := filepath.Join(dir, "key")
	key := bytes.Repeat([]byte{7}, 32)
	if err := os.WriteFile(keyPath, key, 0600); err != nil {
		t.Fatal(err)
	}
	sealed, err := transform("encrypt", key, []byte("synthetic private dump"))
	if err != nil {
		t.Fatal(err)
	}
	if err = run([]string{"verify", "-key-file", keyPath}, bytes.NewReader(sealed)); err != nil {
		t.Fatal(err)
	}
	files, err := os.ReadDir(dir)
	if err != nil || len(files) != 1 {
		t.Fatal("verify created an output file")
	}
	out := filepath.Join(dir, "plaintext")
	if err = run([]string{"verify", "-key-file", keyPath, "-out", out}, bytes.NewReader(sealed)); err == nil {
		t.Fatal("verify accepted output")
	}
	if _, err = os.Stat(out); !os.IsNotExist(err) {
		t.Fatal("verify wrote plaintext")
	}
	for _, bad := range [][]byte{sealed[:len(sealed)-1], append(append([]byte{}, sealed...), 0), []byte("invalid archive")} {
		if err = run([]string{"verify", "-key-file", keyPath}, bytes.NewReader(bad)); err == nil {
			t.Fatal("verify accepted altered data")
		}
	}
	if err = os.WriteFile(keyPath, bytes.Repeat([]byte{8}, 32), 0600); err != nil {
		t.Fatal(err)
	}
	if err = run([]string{"verify", "-key-file", keyPath}, bytes.NewReader(sealed)); err == nil {
		t.Fatal("verify accepted wrong key")
	}
}
