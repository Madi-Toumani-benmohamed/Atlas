// archive encrypts or verifies/decrypts a bounded PostgreSQL dump with AES-256-GCM.
// It never prints keys and never overwrites an existing output file.
package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

const maximum = 512 << 20

var magic = []byte("ATLAS-AESGCM-v1\n")

func transform(mode string, key, input []byte) ([]byte, error) {
	if len(key) != 32 {
		return nil, errors.New("key must be exactly 32 bytes")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if mode == "encrypt" {
		if len(input) > maximum {
			return nil, errors.New("dump exceeds 512 MiB")
		}
		nonce := make([]byte, gcm.NonceSize())
		if _, err = rand.Read(nonce); err != nil {
			return nil, err
		}
		out := append(append([]byte{}, magic...), nonce...)
		return gcm.Seal(out, nonce, input, magic), nil
	}
	if mode != "decrypt" {
		return nil, errors.New("unsupported mode")
	}
	if len(input) < len(magic)+gcm.NonceSize()+gcm.Overhead() || string(input[:len(magic)]) != string(magic) {
		return nil, errors.New("invalid archive header")
	}
	nonce := input[len(magic) : len(magic)+gcm.NonceSize()]
	plain, err := gcm.Open(nil, nonce, input[len(magic)+gcm.NonceSize():], magic)
	if err != nil {
		return nil, errors.New("archive authentication failed")
	}
	if len(plain) > maximum {
		return nil, errors.New("dump exceeds 512 MiB")
	}
	return plain, nil
}
func writeNew(path string, data []byte) error {
	f, err := os.CreateTemp(filepath.Dir(path), ".atlas-archive-*")
	if err != nil {
		return err
	}
	name := f.Name()
	defer os.Remove(name)
	if _, err = f.Write(data); err != nil {
		f.Close()
		return err
	}
	if err = f.Sync(); err != nil {
		f.Close()
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	// Link refuses an existing destination atomically; outputs stay mode 0600.
	return os.Link(name, path)
}
func run(args []string, stdin io.Reader) error {
	if len(args) < 1 {
		return errors.New("usage: archive keygen|encrypt|decrypt -out FILE [-key-file FILE]")
	}
	flags := flag.NewFlagSet("archive", flag.ContinueOnError)
	out := flags.String("out", "", "new output file")
	keyPath := flags.String("key-file", "", "32-byte key file")
	if err := flags.Parse(args[1:]); err != nil {
		return err
	}
	if *out == "" || flags.NArg() != 0 {
		return errors.New("an output file is required")
	}
	if args[0] == "keygen" {
		key := make([]byte, 32)
		if _, err := rand.Read(key); err != nil {
			return err
		}
		return writeNew(*out, key)
	}
	keyFile, err := os.Open(*keyPath)
	if err != nil {
		return errors.New("cannot read key file")
	}
	defer keyFile.Close()
	key, err := io.ReadAll(io.LimitReader(keyFile, 33))
	if err != nil {
		return errors.New("cannot read key file")
	}
	input, err := io.ReadAll(io.LimitReader(stdin, maximum+128))
	if err != nil {
		return err
	}
	if len(input) >= maximum+128 {
		return errors.New("archive too large")
	}
	data, err := transform(args[0], key, input)
	if err != nil {
		return err
	}
	return writeNew(*out, data)
}
func main() {
	if err := run(os.Args[1:], os.Stdin); err != nil {
		fmt.Fprintln(os.Stderr, "archive:", err)
		os.Exit(1)
	}
}
