output "server_public_ip" {
  value = aws_instance.devsecops_server.public_ip
}
