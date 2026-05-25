variable "aws_region" {
  type    = string
  default = "eu-central-1"
}

variable "allowed_ip_cidr" {
  type        = string
  description = "Use your own IP in CIDR format, for example 1.2.3.4/32"
}

variable "ami_id" {
  type        = string
  description = "Ubuntu AMI ID for the selected region"
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}

variable "key_name" {
  type        = string
  description = "Existing AWS EC2 key pair name"
}
